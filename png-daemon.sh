#!/bin/bash
#until watch -n 0.3 ./lib/png2 /Users/dmitryduev/web/sserv-sserv-njs/public /Users/dmitryduev/web/sserv/telemetry; do
#    echo "'png2' crashed with exit code $?. Restarting..." >&2
#    sleep 1
#done
#until while true; do ./lib/png2 /Users/dmitryduev/web/sserv-njs/public /Users/dmitryduev/web/sserv/telemetry; sleep 0.3; done
until while true; do ./lib/png2 /home/roboao/web/sserv-njs/public /home/roboao/Status; sleep 0.3; done
do
   echo "'png2' crashed with exit code $?. Rerunning..." >&2
   sleep 1
done
