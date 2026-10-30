"""Build explicit skill/source links from factual public datasets, without evaluating JS."""
import json,re

def literals(bundle):
    for m in re.finditer(r'\w+=JSON.parse\(`(.*?)`\)',bundle,re.S):
        if '${' not in m[1]:
            try: yield json.loads(m[1].replace('\\\\','\\'))
            except ValueError: pass

def build_links(data,bundle,rewards):
    skills=data['skills']; chars=data['characters']; supports=data['supports']
    byname={s['skillName']:s['skillId'] for s in skills}; valid=set(byname.values())
    links={str(s['skillId']):{'variants':[], 'characters':[], 'characterEvents':[], 'supportHints':[], 'supportEvents':[]} for s in skills}
    def add(sid,kind,entry):
        dest=links.get(str(sid),{}).get(kind)
        if dest is not None and entry not in dest: dest.append(entry)
    for c in chars:
        for sid in str(c.get('skillIds','')).split(','):
            if sid.isdigit() and not any(p['skillId']==int(sid) for p in c.get('potentialSkills',[])) and not (c['cardId']%100>1 and int(sid)==100001+(c['charaId']-1000)*10): add(int(sid),'characters',{'id':c['cardId'],'detail':'Initial skill'})
        for p in c.get('potentialSkills',[]):add(p['skillId'],'characters',{'id':c['cardId'],'detail':'Initial skill' if p['needRank']==0 else f"Awakening rank {p['needRank']}"})
    for c in supports:
        for h in c.get('skillHints',[]):add(h['skillId'],'supportHints',{'id':c['supportCardId'],'detail':'Training hint'})
    charids={c['cardId'] for c in chars}
    for rows in literals(bundle):
        if not isinstance(rows,list) or not rows or not isinstance(rows[0],dict) or 'card_title' not in rows[0]:continue
        for c in rows:
            if c['card_id'] not in charids:continue
            for e in c.get('events',[]):
                for option in e.get('options',[]):
                    for outcome in option.get('outcomes',[]):
                        for sid in re.findall(r'\b(\d{5,9})\s+hint',outcome):add(int(sid),'characterEvents',{'id':c['card_id'],'detail':e['event_name']})
    rows=next(literals(rewards))
    for e in rows:
        story=int(re.sub(r'\D','',str(e.get('story_id') or '0')))
        explicit=int(float(e.get('support_card_id') or 0));chara=int(float(e.get('support_chara_id') or 0))
        inferred=not chara
        if not chara and 800000000<=story<810000000:chara=story//1000%10000
        cards=[c for c in supports if c['supportCardId']==explicit] if explicit else [c for c in supports if c['charaId']==chara and (not e.get('card_rarity') or c['rarityDisplay']==e['card_rarity']) and (not inferred or any(int(ev['storyId'])==story for ev in c.get('events',[])))]
        for k,opt in e.items():
            if not k.startswith('Option_') or not isinstance(opt,dict):continue
            for outcome in opt.values():
                if not isinstance(outcome,dict):continue
                ids=set()
                for key,val in outcome.items():
                    if key.startswith('skill_id_') and val: ids.update(int(v) for v in re.findall(r'\d{5,9}',str(val)))
                    if key.startswith('skill_name_') and val in byname:ids.add(byname[val])
                for sid in ids:
                    for c in cards:add(sid,'supportEvents',{'id':c['supportCardId'],'detail':e.get('event_name') or f'Event {story}'})
    families={}
    for s in skills:families.setdefault(s['skillId']//10,[]).append(s['skillId'])
    aliases={}
    for short,long in [('Speed','Speed'),('Stamina','Stamina'),('Power','Power'),('Guts','Guts'),('Wit','Wit'),('Mood','Mood')]:aliases['Racing Spirit: '+short]='Racing Spirit: '+long+' +'
    for short,long in [('SPD','Speed'),('STA','Stamina'),('PWR','Power'),('GUTS','Guts'),('WIT','Wit')]:aliases['Ignited Spirit '+short]='Ignited Spirit: '+long+' +'
    fbyname={f['text']:int(f['id']) for f in data['factors']}
    factoraliases={}
    for a,b in aliases.items():
        if a in fbyname and b in fbyname:
            pair=[fbyname[a],fbyname[b]]
            for id in pair:factoraliases[str(id)]=pair
        if a in byname and b in byname:
            ids=set(families[byname[a]//10]+families[byname[b]//10])
            for id in ids:links[str(id)]['variants']=sorted(ids-{id})
    for s in skills:
        row=links[str(s['skillId'])]
        row['variants']=sorted(set(row['variants']+families[s['skillId']//10])-{s['skillId']})
        # Unique skill / inherited counterpart use an explicit game ID offset.
        if s['skillCategory']=='Unique':
            base=s['skillId']-800000 if 900000<=s['skillId']<1000000 else s['skillId']
            base=base+90000 if 10000<=base<100000 else base
            for candidate in [base,base+800000,base-90000]:
                if candidate in valid and candidate!=s['skillId']:row['variants']=sorted(set(row['variants']+[candidate]))
    factorSkills={}
    for f in data['factors']:
        if int(f['type'])!=3:continue
        sid=byname.get(f['text'])
        if not sid:
            alternate=aliases.get(f['text']) or next((a for a,b in aliases.items() if b==f['text']),None)
            sid=byname.get(alternate)
        if sid:
            ids=[sid]+links[str(sid)]['variants']
            factorSkills[str(f['id'])]=[i for i in ids if next(s for s in skills if s['skillId']==i)['rarity'] in [1,2]]
    match=re.search(r'\bN=\{([\d:,]+)\}',bundle)
    if not match:raise ValueError('Outfit artwork mapping not found')
    outfits=dict(pair.split(':') for pair in match[1].split(','))
    return {'skills':links,'factorAliases':factoraliases,'factorSkills':factorSkills,'outfits':outfits}
