export const Register = ({
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
      <circle cx="10" cy="6" r="4" strokeWidth="1.5" />
      <path
        d="M21 10H19M19 10H17M19 10L19 8M19 10L19 12"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M17.9975 18C18 17.8358 18 17.669 18 17.5C18 15.0147 14.4183 13 10 13C5.58172 13 2 15.0147 2 17.5C2 19.9853 2 22 10 22C12.231 22 13.8398 21.8433 15 21.5634"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
