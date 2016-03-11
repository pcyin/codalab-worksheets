#!./venv/bin/python
"""
Script that creates the root user.
"""
import sys
sys.path.append('.')

import getpass

from codalab.lib import crypt_util
from codalab.lib.codalab_manager import CodaLabManager
from codalab.objects.user import User

manager = CodaLabManager()
model = manager.model()

username = manager.root_user_name()
user_id = manager.root_user_id()

if len(sys.argv) == 2:
    password = sys.argv[1]
else:
    while True:
        password = getpass.getpass()
        if getpass.getpass('Config password: ') == password:
            break
    
        print 'Passwords don\'t match. Try again.'
        print

try:
    model.add_user(username, '', password, user_id, is_verified=True)
except Exception as e:
    update = {
        "user_id": user_id,
        "user_name": username,
        "password": User.encode_password(password, crypt_util.get_random_string()),\
        "is_active": True,
        "is_verified": True,
    }
    model.update_user_info(update)
