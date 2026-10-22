import test from 'node:test';
import assert from 'node:assert/strict';
import {profileSchema,seedProfile} from '../server/model.js';
import {previewFollowUp} from '../shared/follow-up.js';
test('email template settings survive validation and retain separate CTA values',()=>{
 const profile=profileSchema.parse({...seedProfile,followUpEnabled:true,followUpStyle:'brand',followUpSubject:'Hi {contact_first_name}',followUpMessage:'From {sender_name}',followUpButtonEnabled:true,followUpButtonLabel:'Book',followUpButtonUrl:'https://example.com/book'});
 assert.equal(profile.followUpStyle,'brand');assert.equal(profile.followUpButtonUrl,'https://example.com/book');assert.equal(profile.customCtaEnabled,false);
});
test('email buttons reject unsafe or incomplete destinations',()=>{
 for(const patch of [{followUpButtonEnabled:true},{followUpButtonEnabled:true,followUpButtonLabel:'Book',followUpButtonUrl:'javascript:alert(1)'},{followUpStyle:'invalid'}])assert.equal(profileSchema.safeParse({...seedProfile,...patch}).success,false);
});
test('preview substitutes only supported tokens without interpreting replacement text',()=>{
 assert.equal(previewFollowUp('Hi {contact_first_name}, from {sender_name} at {company}. {unknown}',{name:'A $& B',company:'Studio'}),'Hi Alex, from A $& B at Studio. {unknown}');
});
