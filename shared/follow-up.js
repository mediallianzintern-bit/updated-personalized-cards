export const defaultFollowUpSubject = 'Great meeting you — let’s keep in touch!';
export const defaultFollowUpMessage = 'Hi {contact_first_name},\n\nIt was a pleasure connecting with you. I look forward to staying in touch and exploring how we can work together.\n\nYou can find my details on my card below.\n\nBest,\n{sender_name}';
export function previewFollowUp(text, profile, contactName = 'Alex') {
  const values = {contact_first_name: contactName, sender_name: profile.name || 'Your name', company: profile.company || 'Your company'};
  return text.replace(/\{(contact_first_name|sender_name|company)\}/g, (_, key) => values[key]);
}
