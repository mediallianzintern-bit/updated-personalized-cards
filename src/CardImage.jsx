import React, {createContext, useContext, useState} from 'react';
export const CardImageContext = createContext({});
export function CardImage({src, ...props}) {
  const urls = useContext(CardImageContext);
  const direct = urls[src];
  const [failedUrl, setFailedUrl] = useState(null);
  // A lazy-loaded image may be reached after its short-lived link expires.
  // Fall back once to the endpoint, which checks current access again.
  const resolved = direct && direct !== failedUrl ? direct : src;
  return <img {...props} decoding="async" src={resolved} onError={() => {
    if (resolved !== src) setFailedUrl(direct);
  }}/>;
}
