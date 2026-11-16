# Maps book pages to the photos of the book. Keys: 'toc', 1..33, '11b', '31b'.
# The photos live outside the public repository; point FR_PHOTOS at their folder (default: ../photos).
import os
U = os.environ.get('FR_PHOTOS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'photos')).rstrip('/\\') + os.sep
P = {'toc': 'p00-contents.jpeg', '11b': 'p11-back.jpeg', '31b': 'p31-back.jpeg'}
for i in range(1, 34): P[i] = f'p{i:02d}.jpeg'
