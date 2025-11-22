export const Clock = ({
  fill = "#fff",
  height,
  label,
  size,
  width,
  ...props
}) => {
  return (
    <svg
      fill="none"
      height={size || height || 24}
      preserveAspectRatio="xMidYMid"
      viewBox="0 0 24 24"
      width={size || width || 24}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="12" cy="12" r="10" stroke={fill} strokeWidth="1.5" />
      <path
        d="M12 8V12L14.5 14.5"
        stroke={fill}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
};
