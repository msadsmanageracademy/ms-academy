export const List = ({
  fill = "#fff",
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
      stroke={fill}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M20 7L4 7" strokeWidth="1.5" strokeLinecap="round" />
      <path
        opacity="0.7"
        d="M15 12L4 12"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path opacity="0.4" d="M9 17H4" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};
