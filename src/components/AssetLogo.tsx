import { useState } from "react";

interface Props {
  ticker: string;
  size?: number;
}

const LOGO_BASE = "https://icons.brapi.dev/icons";

export function AssetLogo({ ticker, size = 20 }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {ticker[0]}
      </div>
    );
  }

  return (
    <img
      src={`${LOGO_BASE}/${ticker.toUpperCase()}.svg`}
      alt={ticker}
      width={size}
      height={size}
      className="shrink-0"
      onError={() => setFailed(true)}
    />
  );
}
