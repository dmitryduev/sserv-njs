from __future__ import print_function
import signal
import time
import datetime
import pytz
from collections import OrderedDict
import pymysql
import pymysql.cursors


class TimeoutError(Exception):
    def __init__(self, value='Operation timed out'):
        self.value = value

    def __str__(self):
        return repr(self.value)


def timeout(seconds_before_timeout):
    """
        A decorator that raises a TimeoutError error if a function/method runs longer than seconds_before_timeout
    :param seconds_before_timeout:
    :return:
    """
    def decorate(f):
        def handler(signum, frame):
            raise TimeoutError()

        def new_f(*args, **kwargs):
            old = signal.signal(signal.SIGALRM, handler)
            old_time_left = signal.alarm(seconds_before_timeout)
            if 0 < old_time_left < seconds_before_timeout:  # never lengthen existing timer
                signal.alarm(old_time_left)
            start_time = time.time()
            try:
                result = f(*args, **kwargs)
            finally:
                if old_time_left > 0:  # deduct f's run time from the saved timer
                    old_time_left -= time.time() - start_time
                signal.signal(signal.SIGALRM, old)
                signal.alarm(old_time_left)
            return result
        new_f.__name__ = f.__name__
        return new_f
    return decorate


def laser_focus_position(temp):
    return temp * -0.05753977 + 24.70071668


@timeout(10)
def meteo():
    """
        Fetch meteo data from KPNO
    :return:
    """
    # Open database connection
    db = pymysql.connect(user='roboao', password='PorQuPine*3',
                         host='rose.kpno.noao.edu',
                         database='KpnoWeather')

    dewpoint, environment = None, None

    try:
        with db.cursor() as cursor:

            if False:
                cursor.execute("SHOW TABLES")
                tables = cursor.fetchall()
                print(tables)

            if False:
                # display column names:
                sql = "SHOW columns FROM 2m_WXstation"
                cursor.execute(sql)
                result = cursor.fetchall()
                # result: air dew hum split
                print(result)
                # data.append(result)

                # (('id', 'int(11)', 'NO', 'PRI', None, 'auto_increment'),
                #  ('telescope_id', 'int(11)', 'YES', '', None, ''),
                #  ('dew_point_time', 'datetime', 'YES', 'MUL', None, ''),
                #  ('air_temperature', 'double', 'YES', '', None, ''),
                #  ('dew_point', 'double', 'YES', '', None, ''),
                #  ('humidity', 'double', 'YES', '', None, ''),
                #  ('split', 'float', 'YES', '', None, ''))

                # (('id', 'int(11)', 'NO', 'PRI', None, 'auto_increment'),
                #  ('date_time', 'datetime', 'YES', '', None, ''),
                #  ('wind_direction', 'double', 'YES', '', None, ''),
                #  ('wind_speed', 'double', 'YES', '', None, ''),
                #  ('humidity', 'double', 'YES', '', None, ''),
                #  ('bar_pressure', 'double', 'YES', '', None, ''),
                #  ('air_temp', 'double', 'YES', '', None, ''),
                #  ('dew_point', 'double', 'YES', '', None, ''),
                #  ('split', 'double', 'YES', '', None, ''),
                #  ('gust', 'double', 'YES', '', None, ''),
                #  ('percent_cloud', 'float', 'YES', '', None, ''),
                #  ('rain', 'float', 'YES', '', None, ''))


            # get dew point data
            sql = "SELECT * FROM 2m_WXstation ORDER BY ID DESC LIMIT 10"
            cursor.execute(sql)
            result = cursor.fetchone()
            # result: air dew hum split
            # print(result)
            dewpoint = result

            if False:
                # display column names:
                sql = "SHOW columns FROM 2m_environment"
                cursor.execute(sql)
                result = cursor.fetchall()
                # result: air dew hum split
                print(result)
                # data.append(result)

            # (('id', 'int(11)', 'NO', 'PRI', None, 'auto_increment'),
            #  ('date_time', 'datetime', 'YES', 'UNI', None, ''),
            #  ('amb_temp', 'double', 'YES', '', None, ''),
            #  ('sec_mir_t', 'double', 'YES', '', None, ''),
            #  ('pier_stairs', 'double', 'YES', '', None, ''),
            #  ('flr_obs', 'double', 'YES', '', None, ''),
            #  ('elevator_t', 'double', 'YES', '', None, ''),
            #  ('mezz_t', 'double', 'YES', '', None, ''),
            #  ('mir_t_top', 'double', 'YES', '', None, ''),
            #  ('mir_t_web', 'double', 'YES', '', None, ''),
            #  ('cntl_room_roof_t', 'double', 'YES', '', None, ''),
            #  ('vis_t_roof', 'double', 'YES', '', None, ''),
            #  ('oil_pad1_t', 'double', 'YES', '', None, ''),
            #  ('wind_speed', 'double', 'YES', '', None, ''),
            #  ('wind_direction', 'double', 'YES', '', None, ''),
            #  ('truss_t', 'double', 'YES', '', None, ''))

            # get environmental data
            sql = "SELECT * FROM 2m_environment ORDER BY ID DESC LIMIT 10"
            cursor.execute(sql)
            result = cursor.fetchone()
            # result: hz
            # print(result)
            environment = result
            # append Laser focus position
            environment = environment + (laser_focus_position(environment[-1]),)

    finally:
        # disconnect from server
        db.close()

    return dewpoint, environment


if __name__ == '__main__':
    try:
        d, e = meteo()
        # d = (16189884, 2, datetime.datetime(2017, 9, 1, 22, 36, 8), 17.6, 14.9, 84.2, 2.7)
        # d = (7633, datetime.datetime(2018, 4, 2, 23, 50, 42), 257.2, 10.1, 16.2, 787.3, 10.2,
        #      -14.3, 24.5, 22.2, -2.0, 0.0)
        # e = (6902884, datetime.datetime(2017, 9, 1, 22, 30, 13), 0.0, 21.3, 21.2, 23.0, 22.2,
        #       22.5, 21.4, 21.1, 21.8, 39.9, 29.7, 1.6, 242.0, 23.9)

        tz = pytz.timezone('US/Arizona')

        if d is not None:
            tt = tz.localize(d[1], is_dst=None)
            with open('/home/roboao/Status/dewpoint_status', 'w') as f:
                f.write('{:s} '.format(tt.astimezone(pytz.utc).strftime('%Y-%m-%d %H:%M:%S') + '.000') +
                        '{:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f}\n'.format(*d[2:]))

        if e is not None:
            tt = tz.localize(e[1], is_dst=None)
            with open('/home/roboao/Status/environment_status', 'w') as f:
                f.write('{:s} '.format(tt.astimezone(pytz.utc).strftime('%Y-%m-%d %H:%M:%S') + '.000') +
   '{:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.1f} {:.3f}\n'.format(*e[2:]))
    finally:
        pass
