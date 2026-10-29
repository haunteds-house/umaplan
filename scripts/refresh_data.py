"""Refresh factual Global data from the public sources documented in SOURCES.md.
Uses curl for HTTP transport; never evaluates downloaded JavaScript.
Run from repository root. Review changes and run npm test before committing.
"""
import concurrent.futures
import datetime
import gzip
import json
import pathlib
import re
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]

def fetch(url):
    proc = subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error', '--max-time', '90', url], check=True, capture_output=True)
    raw = proc.stdout
    return gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw

def main():
    page = fetch('https://uma.guide/roster-viewer/').decode()
    paths = re.findall(r'(?:src|href)="([^" ]*/chunks/uma-data\.[^" ]+\.js)"', page)
    if not paths:
        raise RuntimeError('Public data bundle not found; inspect current site format.')
    url = 'https://uma.guide' + paths[0] if paths[0].startswith('/') else paths[0]
    bundle = fetch(url).decode()
    extracted = {}
    for match in re.finditer(r'\w+=JSON.parse\(`(.*?)`\)', bundle, re.S):
        literal = match[1]
        if '${' in literal:
            continue
        try:
            rows = json.loads(literal.replace('\\\\', '\\'))
        except ValueError:
            continue
        if not isinstance(rows, list) or not rows or not isinstance(rows[0], dict):
            continue
        fields = rows[0]
        name = 'characters' if 'aptitudeTurf' in fields and 'cardId' in fields else 'supports' if 'supportCardTypeName' in fields and 'supportCardId' in fields else 'skills' if 'activationCondition' in fields and 'skillId' in fields else None
        if name:
            if name in extracted:
                raise RuntimeError('Ambiguous public dataset: ' + name)
            extracted[name] = rows
    if set(extracted) != {'characters', 'supports', 'skills'}:
        raise RuntimeError('Incomplete guide datasets; existing files left unchanged.')
    manifest = json.loads(fetch('https://uma.moe/resources/manifest.json'))
    entries = {x['name']: x for x in manifest['artifacts']}
    names = ['affinity', 'factors', 'race_to_saddle_mapping']
    def get(name):
        path = entries[name + '.json'].get('current_path') or entries[name + '.json']['path']
        return name, json.loads(fetch('https://uma.moe' + path))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        data = dict(pool.map(get, names))
    a = data['affinity']; size = len(a['chars'])
    if len(a['aff2']) != size**2 or len(a['aff3']) != size**3:
        raise RuntimeError('Incomplete affinity matrix.')
    races = {}
    for race in data.pop('race_to_saddle_mapping')['races']:
        for s in race['win_saddles']:
            if s['win_saddle_type'] == 3:
                races[str(s['saddle_id'])] = {'group': s['group_id'], 'name': race['name']}
    data.update(extracted); data['races'] = races
    data['metadata'] = {'region': 'Global', 'retrieved': datetime.date.today().isoformat(), 'guideBundle': url, 'moeVersion': manifest['version'], 'counts': {n: len(data[n]) for n in ['characters', 'supports', 'skills', 'factors']}}
    for name, value in data.items():
        (ROOT / 'data' / (name + '.json')).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('Updated public Global snapshot. Review the diff and run npm test.')

if __name__ == '__main__':
    main()
