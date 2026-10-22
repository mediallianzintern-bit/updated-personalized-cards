import React from 'react';

const backgrounds = { light: '#ffffff', dark: '#15191f', transparent: 'transparent' };
export function logoPresentation(profile) {
  const mode = ['light', 'dark', 'transparent', 'custom'].includes(profile.logoBackground) ? profile.logoBackground : 'light';
  const custom = /^#[0-9a-f]{6}$/i.test(profile.logoBackgroundColor || '') ? profile.logoBackgroundColor : '#ffffff';
  const size = ['small', 'medium', 'large'].includes(profile.logoSize) ? profile.logoSize : 'medium';
  return { className: `card-logo-frame logo-size-${size}`, style: { backgroundColor: mode === 'custom' ? custom : backgrounds[mode] } };
}

export default function LogoSettings({ profile, onChange }) {
  return <fieldset className="logo-settings">
    <legend>Logo appearance</legend>
    <p>Give your logo its own background so it stays clear with every card colour. Your whole logo stays visible.</p>
    <div className="logo-settings-grid">
      <label><span>Logo background</span><select aria-label="Logo background" value={profile.logoBackground || 'light'} onChange={e => onChange('logoBackground', e.target.value)}>
        <option value="light">Light · white</option><option value="dark">Dark · charcoal</option><option value="transparent">Transparent</option><option value="custom">Custom colour</option>
      </select></label>
      <label><span>Logo size</span><select aria-label="Logo size" value={profile.logoSize || 'medium'} onChange={e => onChange('logoSize', e.target.value)}>
        <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
      </select></label>
      {profile.logoBackground === 'custom' && <label><span>Logo background colour</span><input type="color" value={profile.logoBackgroundColor || '#ffffff'} onChange={e => onChange('logoBackgroundColor', e.target.value)}/></label>}
    </div>
    {!profile.logo && <small>Upload a company logo to see these settings in your preview.</small>}
  </fieldset>;
}
