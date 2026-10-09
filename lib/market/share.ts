export type ShareTarget = { id: 'whatsapp' | 'telegram' | 'email' | 'facebook' | 'x' | 'linkedin'; href: string };

/** Plain share URLs for each network. No tracking parameters and no third-party scripts. */
export function shareTargets(url: string, message: string): ShareTarget[] {
  const link = encodeURIComponent(url);
  const text = encodeURIComponent(message);
  return [
    { id: 'whatsapp', href: `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}` },
    { id: 'telegram', href: `https://t.me/share/url?url=${link}&text=${text}` },
    { id: 'email', href: `mailto:?subject=${text}&body=${link}` },
    { id: 'facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${link}` },
    { id: 'x', href: `https://x.com/intent/post?url=${link}&text=${text}` },
    { id: 'linkedin', href: `https://www.linkedin.com/sharing/share-offsite/?url=${link}` },
  ];
}
