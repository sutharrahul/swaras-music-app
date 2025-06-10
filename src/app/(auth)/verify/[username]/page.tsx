import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";

export default function VerifyAccount() {
  const [verifyCode, setVerifyCode] = useState();
  const router = useRouter();
  const params = useParams();

  const verifyUser = async () => {};

  return <div>VerifyAccount</div>;
}
