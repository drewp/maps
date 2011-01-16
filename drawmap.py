#!bin/python
"""
manual import
dash(pts/26):/my/site/maps% mongoimport -h bang --drop -d map -c map < updates.log 

"""
from __future__ import division
from profilehooks import timecall, profile
import sys, math
import tempfile
from math import pi
from random import random
from pymongo import Connection, DESCENDING
from locations import readGoogleMapsLocations
#sys.path.append("Rtree-0.6.0/build/lib.linux-x86_64-2.6")
import rtree

import cairo

mongo = Connection('bang', 27017)['map']['map']

userColor = {
    'http://bigasterisk.com/foaf.rdf#drewp' : (.2, 1, .2),
    'http://bigasterisk.com/kelsi/foaf.rdf#kelsi' : (237/255, 103/255, 163/255),
    }
def randColor(user):
    rgb = userColor[user]
    return [max(0, min(1, c + random() * .4 - .2)) for c in rgb]

def drawPath(ctx, surf, color, age, p):
    if len(p) < 2:
        return
    ctx.new_path()
    ctx.move_to(*p[0])
    for pt in p:
        ctx.line_to(*pt)
    ctx.set_source_rgb(*color)
    ctx.set_line_width(20/age)
    ctx.stroke()

def dot(ctx, pos, radius, edgeWidth, fillColor, edgeColor):
    ctx.new_path()
    ctx.arc(pos[0], pos[1], radius, 0, 2*pi)
    ctx.set_source_rgb(*fillColor)
    ctx.fill_preserve()
    if edgeWidth:
        ctx.set_source_rgb(*edgeColor)
        ctx.set_line_width(edgeWidth)
        ctx.stroke()

class Coord(object):
    def __init__(self, surf, points, locs):
        self.surf = surf
        self.margin = 5 # px
        
        ctr = sum(x[0] for x in points) / len(points), sum(x[1] for x in points) / len(points)
        radius = 0
        for p in points:
            dist = math.hypot(p[0] - ctr[0], p[1] - ctr[1])
            radius = max(radius, dist)

        # still wrong; this grows around the center of points instead of
        # only growing in the direction of the nearest loc
        inRange = 0
        locRadii = []
        for name, (lat, lng) in locs:
            dist = math.hypot(lng - ctr[0], lat - ctr[1])
            if dist < radius:
                inRange += 1
            else:
                locRadii.append(dist)
        if inRange < 1:
            locRadii.sort()
            radius = locRadii[0]
        print inRange, locRadii

        self.xlo, self.xhi = ctr[0] - radius, ctr[0] + radius
        self.ylo, self.yhi = ctr[1] - radius, ctr[1] + radius # assuming square aspect
        
    def screenFromWorld(self, lng, lat):
        x = (lng - self.xlo) / (self.xhi - self.xlo) * (self.surf.get_width() - 2*self.margin) + self.margin
        y = self.surf.get_height() - ((lat - self.ylo) / (self.yhi - self.ylo) * (self.surf.get_height() - 2*self.margin) + self.margin)
        return x, y                


def drawLocations(coord, ctx, locs):
    labels = rtree.Rtree()
    for name, (lat, lng) in locs:
        pos = coord.screenFromWorld(lng, lat)

        ctx.select_font_face("Verdana",
                cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
        ctx.set_font_size(9)
        x_bearing, y_bearing, width, height = ctx.text_extents(name)[:4]

        pos = pos[0] + 5, pos[1]
        newRegion = (pos[0], pos[1], pos[0] + width, pos[1] + height)
        if list(labels.intersection(newRegion)):
            continue
        dot(ctx, (pos[0] - 5, pos[1]), 4, 1, (0,.3,0), (0,.5,0))
        labels.add(0, newRegion)
        ctx.move_to(*pos)
        ctx.set_source_rgb(1, 1, 0.0)
        ctx.show_text(name)

def drawPerson(coord, ctx, user, lng, lat, people):
    pos = coord.screenFromWorld(lng, lat)

    for p in people:
        dx = pos[0] - p[0]
        if abs(dx) < 16:
            pos = pos[0] + 16-dx, pos[1]

    people.append(pos)
    dot(ctx, pos, 10, 1, userColor[user], (0, .5, .9))
    initial = user.split('#')[1][0].upper()

    ctx.set_source_rgb(0,0,0)
    ctx.select_font_face("Verdana",
                         cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(14)
    x_bearing, y_bearing, width, height = ctx.text_extents(initial)[:4]
    ctx.move_to(pos[0] - width / 2, pos[1] + height / 2)
    ctx.show_text(initial)

def makeSurf(width, height):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, width, height)
    ctx = cairo.Context(surf)
    ctx.set_source_rgb(0,0,0)
    ctx.paint()
    return surf, ctx

def toPng(surf):
    out = tempfile.NamedTemporaryFile()
    surf.write_to_png(out.name)
    out.seek(0)
    return out.read()


@profile(immediate=True)
def mapImage(width=320, height=320, history=10):
    surf, ctx = makeSurf(width, height)
    mongo.ensure_index([('timestamp', -1)])
    rows = list(mongo.find().sort('timestamp', DESCENDING).limit(history))
    points = []
    for row in rows:
        points.append((row['longitude'], row['latitude']))

    locs = readGoogleMapsLocations()

    coord = Coord(surf, points, locs)

    prevRow = None
    path = []
    color = None
    for age, row in enumerate(rows):
        pos = coord.screenFromWorld(row['longitude'], row['latitude'])
        if color is None:
            color = randColor(row['user'])        
        dot(ctx, pos, 3, 0, color, (0,0,0))
        if (prevRow and (
            (abs(row['timestamp'] - prevRow['timestamp']) > 10*60*1000) or
            (row['user'] != prevRow['user'])
            )):
            drawPath(ctx, surf, color, age, path)
            path = []
            color = None
        path.append(pos)

        prevRow = row

    if color:
        drawPath(ctx, surf, color, age, path)

    drawLocations(coord, ctx, locs)

    people = []
    seen = set()
    for row in rows:
        if row['user'] in seen:
            continue
        drawPerson(coord, ctx, row['user'], row['longitude'], row['latitude'], people)
        seen.add(row['user'])

    return toPng(surf)

if __name__ == '__main__':
    print mapImage()
