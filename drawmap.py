#!bin/python
"""
manual import
dash(pts/26):/my/site/maps% mongoimport -h bang --drop -d map -c map < updates.log 

"""
from __future__ import division
import sys
from math import pi
from random import random
from pymongo import Connection, DESCENDING
from locations import readGoogleMapsLocations
#sys.path.append("Rtree-0.6.0/build/lib.linux-x86_64-2.6")
import rtree

import cairo

mongo = Connection('bang', 27017)['map']['map']

_locs = None # move this cache to locations.py!
def getLocations():
    global _locs
    if _locs is None:
        _locs = readGoogleMapsLocations()
    return _locs

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
    
def mapImage(width=320, height=320, history=10):

    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, width, height)
    ctx = cairo.Context(surf)
    ctx.set_source_rgb(0,0,0)
    ctx.paint()

    rows = list(mongo.find().sort('timestamp', DESCENDING).limit(history))
    points = []
    for row in rows:
        points.append((row['longitude'], row['latitude']))
    xlo, xhi = min(x[0] for x in points), max(x[0] for x in points)
    ylo, yhi = min(x[1] for x in points), max(x[1] for x in points)
    # local area only
    #xlo, xhi, ylo, yhi = -122.324604, -122.201544642, 37.4879908562, 37.5622612238

    margin = 30 # px
    def screenFromWorld(lng, lat):
        return ((lng - xlo) / (xhi - xlo) * (surf.get_width() - 2*margin) + margin,
                surf.get_height() - ((lat - ylo) / (yhi - ylo) * (surf.get_height() - 2*margin) + margin))


    def drawLocations(ctx, locs):
        labels = rtree.Rtree()
        for name, (lat, lng) in locs:
            pos = screenFromWorld(lng, lat)

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


    prevRow = None
    path = []
    color = None
    for age, row in enumerate(rows):
        pos = screenFromWorld(row['longitude'], row['latitude'])
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

    locs = getLocations()
    drawLocations(ctx, locs)

    people = []
    def drawPerson(user, lng, lat):
        pos = screenFromWorld(lng, lat)

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

    seen = set()
    for row in rows:
        if row['user'] in seen:
            continue
        drawPerson(row['user'], row['longitude'], row['latitude'])
        seen.add(row['user'])

    import tempfile
    out = tempfile.NamedTemporaryFile()
    surf.write_to_png(out.name)
    out.seek(0)
    return out.read()

if __name__ == '__main__':
    print mapImage()
