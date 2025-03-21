export const UserId = ({
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
      <circle cx="9" cy="9" r="2" strokeWidth="1.5" />
      <path
        d="M13 15C13 16.1046 13 17 9 17C5 17 5 16.1046 5 15C5 13.8954 6.79086 13 9 13C11.2091 13 13 13.8954 13 15Z"
        strokeWidth="1.5"
      />
      <path
        d="M2 12C2 8.22876 2 6.34315 3.17157 5.17157C4.34315 4 6.22876 4 10 4H14C17.7712 4 19.6569 4 20.8284 5.17157C22 6.34315 22 8.22876 22 12C22 15.7712 22 17.6569 20.8284 18.8284C19.6569 20 17.7712 20 14 20H10C6.22876 20 4.34315 20 3.17157 18.8284C2 17.6569 2 15.7712 2 12Z"
        strokeWidth="1.5"
      />
      <path d="M19 12H15" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 9H14" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 15H16" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};
