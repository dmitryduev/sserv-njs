import hashlib

ht = hashlib.blake2b(digest_size=12)
ht.update(_task.encode('utf-8'))
hsh = ht.hexdigest()

if __name__ == '__main__':

    ''' Create command line argument parser '''
    parser = argparse.ArgumentParser(formatter_class=argparse.RawDescriptionHelpFormatter,
                                     description='Generate password hash')

    parser.add_argument('config_file', metavar='config_file',
                        action='store', help='path to config file.', type=str)

    args = parser.parse_args()