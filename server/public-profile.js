// Deliberate allowlist: new editor settings are private unless added here.
const displayFields = ['name','title','company','slug','photo','logo','cover','accent','background',
  'buttonColor','photoPositionX','photoPositionY','coverDisplay','coverPositionX','coverPositionY',
  'logoBackground','logoBackgroundColor','logoSize','layout','font','radius','saveEnabled',
  'exchangeEnabled','saveLabel','exchangeLabel','showBranding','customCtaEnabled'];
const formFields = ['exchangeFlow','requireEmail','consentEnabled','exchangeCustomEnabled',
  'exchangeCustomRequired','exchangeWidgets'];
const sectionNames = ['about','contact','links','socials','gallery','videos','files'];
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key,value[key]]));

export function publicProfile(profile) {
  const result = pick(profile, displayFields);
  result.visibleSections = sectionNames.filter(name => profile.visibleSections?.includes(name));
  result.sectionOrder = (profile.sectionOrder || []).filter(name => result.visibleSections.includes(name));
  const visible = name => result.sectionOrder.includes(name);
  result.about = visible('about') ? profile.about : '';
  for (const key of ['email','phone','website','location']) result[key] = visible('contact') ? profile[key] : '';
  result.links = visible('links') ? (profile.links || []).filter(item => item.enabled).map(item => pick(item,['id','title','description','thumbnail','url','icon','enabled'])) : [];
  result.socials = visible('socials') ? (profile.socials || []).map(item => pick(item,['id','platform','url'])) : [];
  result.gallery = visible('gallery') ? (profile.gallery || []).map(item => pick(item,['id','title','image'])) : [];
  result.videos = visible('videos') ? (profile.videos || []).map(item => pick(item,['id','title','url','thumbnail'])) : [];
  result.files = visible('files') ? (profile.files || []).map(item => pick(item,['id','title','name','data'])) : [];
  if (profile.exchangeEnabled) {
    Object.assign(result,pick(profile,formFields));
    result.exchangeFields = pick(profile.exchangeFields,['phone','company','message']);
    if (profile.exchangeCustomEnabled) result.exchangeCustomLabel = profile.exchangeCustomLabel;
  }
  if (profile.customCtaEnabled) Object.assign(result,pick(profile,['customCtaLabel','customCtaUrl']));
  return result;
}
