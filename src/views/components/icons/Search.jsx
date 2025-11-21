export const Search = ({
  fill = "currentColor",
  filled,
  size,
  height,
  width,
  label,
  ...props
}) => {
  return (
    <svg
      width={size || width || 24}
      height={size || height || 24}
      viewBox="0 0 24 24"
      fill={filled ? fill : "none"}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M20.3133 11.1566C20.3133 16.2137 16.2137 20.3133 11.1566 20.3133C6.09956 20.3133 2 16.2137 2 11.1566C2 6.09956 6.09956 2 11.1566 2C16.2137 2 20.3133 6.09956 20.3133 11.1566Z"
        fill="#8cacf7"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.8382 18.8382C19.1205 18.5559 19.5783 18.5559 19.8606 18.8382L21.7883 20.7659C22.0706 21.0483 22.0706 21.506 21.7883 21.7883C21.506 22.0706 21.0483 22.0706 20.7659 21.7883L18.8382 19.8606C18.5559 19.5783 18.5559 19.1205 18.8382 18.8382Z"
        fill="#8cacf7"
      />
    </svg>
  );
};
