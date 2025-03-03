import { TailSpin } from "react-loader-spinner";

export const TailSpinSpinner = () => {
  return (
    <TailSpin
      visible={true}
      height="80"
      width="80"
      color="rgb(4, 14, 4)"
      ariaLabel="tail-spin-loading"
      radius="1"
      wrapperStyle={{}}
      wrapperClass=""
    />
  );
};

export default TailSpinSpinner;
