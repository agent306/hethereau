import React, { useEffect, useState } from 'react';

export default function ItemAvatar({ item, size = 'sm' }) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [item?.avatar]);

  const src = item?.avatar && !imgFailed ? item.avatar : null;

  const dims =
    size === 'lg'
      ? 'h-10 w-10 text-xs'
      : size === 'md'
        ? 'h-8 w-8 text-[11px]'
        : 'h-6 w-6 text-[10px]';

  const frame =
    item?.rarity >= 5
      ? 'ring-[#f5c451]/70 bg-gradient-to-br from-[#f5c451]/25 via-[#181626] to-[#0b0d14]'
      : item?.rarity === 4
        ? 'ring-[#e046ff]/55 bg-gradient-to-br from-[#e046ff]/20 via-[#171326] to-[#0b0d14]'
        : 'ring-[#2ee6ff]/40 bg-gradient-to-br from-[#2ee6ff]/15 via-[#101826] to-[#0b0d14]';

  if (src) {
    return (
      <img
        src={src}
        alt={item.name || item.id}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className={`${dims} shrink-0 rounded-md object-cover object-center ring-1 ${frame}`}
      />
    );
  }

  return (
    <span
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white/90 ring-1 ${frame}`}
      style={{
        backgroundColor: item?.color ? `${item.color}28` : undefined,
      }}
    >
      <span
        className="h-2.5 w-2.5 rotate-45"
        style={{
          backgroundColor:
            item?.color ||
            (item?.rarity >= 5
              ? '#f5c451'
              : item?.rarity === 4
                ? '#e046ff'
                : '#2ee6ff'),
        }}
      />
    </span>
  );
}
