import React, { useState } from 'react';

export default function ItemAvatar({ item, size = 'sm' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = item?.avatar && !imgFailed ? item.avatar : null;

  const dims =
    size === 'lg'
      ? 'h-9 w-9 text-xs'
      : size === 'md'
        ? 'h-7 w-7 text-[11px]'
        : 'h-6 w-6 text-[10px]';

  const ring =
    item?.rarity >= 5
      ? 'ring-amber-400/60 bg-amber-500/15'
      : item?.rarity === 4
        ? 'ring-fuchsia-400/50 bg-fuchsia-500/15'
        : 'ring-sky-400/35 bg-sky-500/10';

  if (src) {
    return (
      <img
        src={src}
        alt={item.name || item.id}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className={`${dims} shrink-0 rounded-full object-cover object-top ring-1 ${ring}`}
      />
    );
  }

  return (
    <span
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white/90 ring-1 ${ring}`}
      style={{
        backgroundColor: item?.color ? `${item.color}33` : undefined,
      }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor:
            item?.color ||
            (item?.rarity >= 5
              ? '#fbbf24'
              : item?.rarity === 4
                ? '#d946ef'
                : '#38bdf8'),
        }}
      />
    </span>
  );
}
