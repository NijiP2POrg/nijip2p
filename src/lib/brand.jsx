const NIJI_DARK = "./assets/brand/niji-dark.png";
const NIJI_LIGHT = "./assets/brand/niji-light.png";
export function LogoMark({
  size = 28,
  variant = "auto",
  ring = true,
  className = "",
  style,
  ...rest
}) {
  if (variant === "dark" || variant === "light") {
    return <img src={variant === "dark" ? NIJI_DARK : NIJI_LIGHT} width={size} height={size} className={"logo-img" + (className ? " " + className : "")} style={style} alt="" aria-hidden="true" draggable={false} {...rest} />;
  }
  return <span className={"lm-auto" + (ring ? " lm-ring" : "") + (className ? " " + className : "")} style={{
    width: size,
    height: size,
    ...style
  }} aria-hidden="true" {...rest}>
            <img className="lm-i lm-light" src={NIJI_LIGHT} alt="" draggable={false} />
            <img className="lm-i lm-dark" src={NIJI_DARK} alt="" draggable={false} />
        </span>;
}
const COIN_SRC = {
  usdc: "./assets/coins/usdc.png",
  usdt: "./assets/coins/usdt.png",
  eth: "./assets/coins/eth.png",
  bnb: "./assets/coins/bnb.png",
  pol: "./assets/coins/pol.png"
};
export function Coin({
  id,
  size = 34,
  title,
  className = "",
  style
}) {
  return <img src={COIN_SRC[id] ?? COIN_SRC.usdc} width={size} height={size} className={"coin-img" + (className ? " " + className : "")} style={style} role="img" aria-label={title ?? id} alt={title ?? id} draggable={false} />;
}
export function CoinRow({
  ids,
  size = 30
}) {
  return <span className="coin-row" aria-hidden="true">
            {ids.map((id, i) => <Coin key={id + i} id={id} size={size} title={id} style={{
      marginLeft: i ? -9 : 0
    }} />)}
        </span>;
}