export const socialPlatforms=['LinkedIn','LinkedIn Company','Instagram','Facebook','X','Threads','TikTok','YouTube','Anchor','Apple Podcast','Bluesky','Calendly','Cash App','Discord','Dribbble','GitHub','GitLab','Messenger','MetaMask','PayPal','Pinterest','Reddit','Snapchat','SoundCloud','Spotify','Telegram','Twitch','Venmo','Vimeo','WhatsApp','Zillow','Truth Social'];
export const sectionLabels={about:'About',links:'Featured links',socials:'Social media',contact:'Contact details',gallery:'Photo gallery',videos:'Videos',files:'Files'};
export const completeOrder=p=>[...p.sectionOrder,...Object.keys(sectionLabels).filter(s=>!p.sectionOrder.includes(s))];

// Account creation precedes private uploads. Keep selected media in the editor
// until the authenticated save completes, so retries never recreate an account.
export function withoutProfileMedia(profile) {
 return {...profile,photo:'',logo:'',cover:'',gallery:[],files:[],
  links:(profile.links||[]).map(item=>({...item,thumbnail:''})),
  videos:(profile.videos||[]).map(item=>({...item,thumbnail:''}))};
}
