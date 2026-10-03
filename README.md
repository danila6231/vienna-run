"package:offline": "npm run build:offline && cp kiosk/launch-offline.bat kiosk/OFFLINE-README.txt dist-offline/ && cd dist-offline && zip -qr ../vienna-run-offline.zip ."

## Deploy
Production: https://vienna-run.vercel.app (Vercel project `vienna-run`, built from `main` of
github.com/danila6231/vienna-run). Until the project is connected to the repo in Vercel
(Settings → Git → Connect), pushes don't deploy on their own; trigger a production deployment
from the Vercel dashboard (or ask Claude, which deploys through the Vercel connector).

