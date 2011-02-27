emu:
	palm-package .
	palm-install -d tcp com.bigasterisk.sendpos_2.0.0_all.ipk
	palm-launch -d tcp com.bigasterisk.sendpos

usb:
	palm-package .
	palm-install -d usb com.bigasterisk.sendpos_2.0.0_all.ipk
	palm-launch -d usb -p "{mojoConfig:true, debuggingEnabled:true}" com.bigasterisk.sendpos


logusb:
	palm-log -f -d tcp com.bigasterisk.sendpos
