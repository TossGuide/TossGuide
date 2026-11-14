"""
Build a small DEVELOPMENT image set from Wikimedia Commons (freely licensed photos
of objects), for tuning before the team's venue photos exist.

    python3 eval/scripts/fetch-commons-devset.py            # writes eval/dev-commons/

Rules we follow:
- Objects only. Every image is reviewed on a contact sheet; any photo showing a
  person is deleted and listed in CREDITS.md as removed.
- Only CC0 / public domain / CC BY / CC BY-SA licences, recorded with the author
  and source URL in eval/dev-commons/CREDITS.md (attribution is required).
- This set is NOT the venue eval. Accuracy on it is labelled "Wikimedia dev set"
  everywhere; the venue numbers come from eval/images/ (team photos).
"""
import json, os, sys, time, urllib.error, urllib.parse, urllib.request, re, html

UA = {'User-Agent': 'TrashifyYEGEvalDevSet/0.2 (student hackathon project; contact via GitHub repo)'}
OUT = 'eval/dev-commons'
PER_ITEM = int(os.environ.get('PER_ITEM', '4'))
OK_LICENCE = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+|CC BY(-SA)?)', re.I)

# item id -> Commons search queries (tried in order until PER_ITEM images are found)
QUERIES = {
    'pop_can': ['aluminium beverage can', 'soda can', 'Coca-Cola can', 'empty soft drink can', 'pepsi can', 'beer can aluminium'],
    'plastic_bottle': ['PET bottle water', 'plastic water bottle', 'empty plastic bottle', 'soft drink plastic bottle'],
    'glass_bottle': ['glass beer bottle', 'empty glass bottle'],
    'juice_box': ['juice box drink carton straw', 'Tetra Pak juice', 'juice box', 'drink box straw', 'Tetra Brik'],
    'milk_carton': ['milk carton', 'gable top carton milk', 'milk carton package', 'carton of milk', 'Milchtüte'],
    'coffee_cup': ['disposable coffee cup', 'paper coffee cup lid'],
    'cold_cup': ['plastic cup iced coffee', 'plastic cup straw drink'],
    'plastic_takeout': ['plastic takeout container', 'plastic food container clamshell'],
    'foam_container': ['styrofoam food container', 'polystyrene foam container'],
    'pizza_box': ['pizza box', 'empty pizza box'],
    'chip_bag': ['potato chips bag', 'crisp packet', 'bag of chips', 'crisps packet', 'Lays chips bag'],
    'candy_wrapper': ['candy wrapper', 'chocolate bar wrapper', 'chocolate bar', 'sweet wrapper', 'candy bar'],
    'plastic_bag': ['plastic shopping bag', 'plastic carrier bag'],
    'food_scraps': ['food waste scraps', 'leftover food scraps', 'vegetable scraps', 'kitchen scraps compost', 'leftover food plate', 'vegetable peelings'],
    'fruit_peel': ['banana peel', 'orange peel'],
    'napkin': ['paper napkin', 'used paper napkin'],
    'paper': ['sheet of paper printer', 'crumpled paper'],
    'cardboard_box': ['cardboard box', 'corrugated cardboard box'],
    'glass_jar': ['empty glass jar', 'glass jar lid'],
    'battery': ['AA battery', 'alkaline batteries'],
    'aluminum_foil': ['aluminium foil crumpled', 'aluminum foil'],
    'food_can': ['tin can food', 'empty tin can', 'canned food', 'can of beans', 'canned tomatoes', 'soup can'],
    'pen': ['ballpoint pen', 'plastic pen'],
    'phone': ['smartphone', 'old mobile phone'],
    'egg_carton': ['egg carton', 'pulp egg carton'],
}

def get(url, tries=6):
    # Be polite: back off on 429 (Commons rate-limits bursts).
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1: raise
            time.sleep(int(e.headers.get('Retry-After') or 0) or 5 * (i + 1))

def search(q):
    u = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query', 'generator': 'search', 'gsrsearch': f'filetype:bitmap {q}', 'gsrnamespace': 6,
        'gsrlimit': 12, 'prop': 'imageinfo', 'iiprop': 'url|extmetadata', 'iiurlwidth': 640, 'format': 'json'})
    d = json.loads(get(u))
    return sorted(d.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))

def strip(s):
    return html.unescape(re.sub('<[^>]+>', '', s or '')).strip()

def main():
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    for item, queries in QUERIES.items():
        if only and item not in only: continue
        d = os.path.join(OUT, item); os.makedirs(d, exist_ok=True)
        got = len([f for f in os.listdir(d) if f.endswith('.jpg')])
        # Skip anything already downloaded or rejected in review (both are in CREDITS.md).
        seen = set(re.findall(r'\[(File:[^\]]+)\]', open(os.path.join(OUT, 'CREDITS.md')).read()))
        for q in queries:
            if got >= PER_ITEM: break
            for p in search(q):
                if got >= PER_ITEM: break
                if p['title'] in seen: continue
                seen.add(p['title'])
                ii = p['imageinfo'][0]; meta = ii.get('extmetadata', {})
                lic = strip(meta.get('LicenseShortName', {}).get('value'))
                if not OK_LICENCE.match(lic) or not ii.get('thumburl', '').split('?')[0].lower().endswith(('.jpg', '.jpeg', '.png')):
                    continue
                got += 1
                n = next(i for i in range(1, 999) if not os.path.exists(os.path.join(d, f'{i}.jpg')))
                path = os.path.join(d, f'{n}.jpg')
                open(path, 'wb').write(get(ii['thumburl']))
                with open(os.path.join(OUT, 'CREDITS.md'), 'a') as f:  # write as we go
                    f.write(f"| {item}/{n}.jpg | [{p['title']}]({ii['descriptionurl']}) | {strip(meta.get('Artist', {}).get('value'))[:60]} | {lic} |\n")
                time.sleep(1.5)
        print(item, got, file=sys.stderr)

if __name__ == '__main__':
    main()
