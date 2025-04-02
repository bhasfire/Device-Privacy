from setuptools import setup

APP = ['server.py']
OPTIONS = {
    'argv_emulation': True,
    'packages': ['fastapi', 'uvicorn', 'starlette'],
    'plist': {
        'CFBundleURLTypes': [
            {
                'CFBundleURLName': 'com.example.deviceprivacymac',
                'CFBundleURLSchemes': ['deviceprivacymac']
            }
        ],
        # 'LSUIElement': True
    },
}

setup(
    app=APP,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
