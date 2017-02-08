from __future__ import print_function
import datetime
import random
import time


def write_status(fout):
    with open(fout, 'w') as f:
        t = datetime.datetime.utcnow()
        t_str = t.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        temp = random.uniform(-70, -81)
        print(t_str, temp)
        n_line = '{:s} 0 20073     0  OFF {:.3f}   0.000  OFF   NO   NO 0 0   5 6 2 0 0      0 0\n'.format(t_str,
                                                                                                           temp)
        f.write(n_line)

if __name__ == '__main__':
    # line = '2016-01-31 13:05:05.001 0 20073     0  OFF -78.598   0.000  OFF   NO   NO 0 0   5 6 2 0 0      0 0'
    while True:
        try:
            write_status(fout='telemetry/vicd_status')
        except KeyboardInterrupt:
            write_status(fout='telemetry/vicd_status')
        time.sleep(1)
