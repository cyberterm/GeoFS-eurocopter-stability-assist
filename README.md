# GeoFS-eurocopter-stability-assist

This repository includes a couple of scripts aiming to enhance the flying experience of the Eurocopter in GeoFS.

### eurocopter_fbw.js
This is like flying with training wheels. The new system takes over control and tries to match the attitude of the helicopter with your stick position. It's very similar to the angle mode drones use.  

### eurocopter_sas.js
This is closer to what the real thing has. It's a system trying to damp any movement, making the helicopter much more stable.

Both scripts include some basic yaw damping. Note that both systems start disarmed by default; press Caps Lock to toggle them on or off during flight.
