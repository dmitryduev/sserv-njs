from __future__ import print_function
import datetime
import time
import numpy as np

if __name__ == '__main__':
    path_logs = '/Users/dmitryduev/_caltech/roboao/robotic_software/Logs/'
    test_file = '/Users/dmitryduev/_caltech/roboao/robotic_software/Logs/test.log'

    while 1:
        with open(test_file, 'a') as f:
            t = datetime.datetime.utcnow()
            test_str = '{:s}  {:.1f}  test\n'.format(t.strftime('%Y%m%d %H:%M:%S.%f'),
                                                     np.random.randint(1, 1000)*0.1)
            print(test_str)
            f.write(test_str)
        time.sleep(0.2)
