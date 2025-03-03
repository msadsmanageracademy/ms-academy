export const Hamburger = ({
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
      width={size || width || 40}
      height={size || height || 28}
      viewBox="0 0 40 28"
      fill={filled ? fill : "none"}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M0 0V4H40V0H0ZM0 12V16H40V12H0ZM0 24V28H40V24H0Z"
        fill="#f7f4ff"
      />
    </svg>
  );
};
