from __future__ import print_function
import time
import psutil
import datetime
import json
import traceback
import argparse

if __name__ == '__main__':
    ''' Create command line argument parser '''
    parser = argparse.ArgumentParser(formatter_class=argparse.RawDescriptionHelpFormatter,
                                     description='Manage data archive for Robo-AO')

    parser.add_argument('config_file', metavar='config_file',
                        action='store', help='path to config file.', type=str)

    args = parser.parse_args()
    # read in config

    with open(args.config_file) as cjson:
        config = json.load(cjson)
        # config must not be empty:
        if len(config) == 0:
            raise Exception('Failed to load config file')

    while 1:
        # construct line with telemetry
        try:
            # UTC running? start_time #_enqueued_tasks system_CPU_usage_% system_memory_usage_%
            _utc_now = datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
            _cpu_usage = psutil.cpu_percent(interval=None)
            _mem_usage = psutil.virtual_memory().percent
            _root = psutil.disk_usage('/').percent
            _data = psutil.disk_usage('/Data').percent
            _data_1 = psutil.disk_usage('/Data1').percent
            _data_2 = psutil.disk_usage('/Data2').percent
            _data_3 = psutil.disk_usage('/Data3').percent
            _data_4 = psutil.disk_usage('/Data4').percent

            _t = '{:s} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f}\n'.format(
                                                _utc_now, _cpu_usage, _mem_usage,
                                               _root, _data, _data_1, _data_2, _data_3, _data_4)
            with open(config['status']['Control machine status']['data-file'], 'w') as _f:
                _f.write(_t)
        except Exception as _e:
            print(_e)
            traceback.print_exc()

            # take a nap
        time.sleep(0.95)
