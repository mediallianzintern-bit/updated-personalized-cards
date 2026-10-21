// Display typography; body text stays consistent for readable contact details.
export const typographyOptions = [
  {id:'sans',name:'Modern',description:'Clean & contemporary',family:"'DM Sans', Arial, sans-serif"},
  {id:'serif',name:'Editorial',description:'Confident & classic',family:'Georgia, serif'},
  {id:'classic',name:'Professional',description:'Simple & familiar',family:'Arial, Helvetica, sans-serif'},
  {id:'humanist',name:'Friendly',description:'Warm & approachable',family:"'Trebuchet MS', sans-serif"},
  {id:'geometric',name:'Clarity',description:'Open & easy to read',family:'Verdana, sans-serif'},
  {id:'elegant',name:'Elegant',description:'Refined & traditional',family:"Palatino, 'Palatino Linotype', 'Book Antiqua', serif"},
  {id:'literary',name:'Literary',description:'Timeless & expressive',family:"'Times New Roman', Times, serif"},
  {id:'mono',name:'Studio',description:'Technical & distinctive',family:"'Courier New', Courier, monospace"},
];
export const typographyIds = typographyOptions.map(option=>option.id);
export const typographyFamily = id => (typographyOptions.find(option=>option.id===id)||typographyOptions[0]).family;
