export const User = ({
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
      stroke="#fff"
      {...props}
    >
      <circle cx="12" cy="9" r="3" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
      <path
        d="M17.9691 20C17.81 17.1085 16.9247 15 11.9999 15C7.07521 15 6.18991 17.1085 6.03076 20"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
