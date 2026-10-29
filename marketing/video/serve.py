import http.server, functools, sys
d = sys.argv[1]
http.server.ThreadingHTTPServer(('127.0.0.1', 8765), functools.partial(http.server.SimpleHTTPRequestHandler, directory=d)).serve_forever()
