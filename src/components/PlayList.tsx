import { truncateByLetters } from "@/app/utils/truncateByLetters";
import React from "react";

export default function PlayList() {
  return (
    <div>
      <ul className="space-y-1">
        <li className="flex items-center gap-5 py-3 px-2">
          <img
            src="./Pic.png"
            className="w-12 h-12 object-cover rounded"
            alt="./Pic.png"
          />

          <div className="flex-1 grid grid-cols-3 gap-5">
            <p className="text-white font-medium truncate ">
              {truncateByLetters("HUM TUMKO NIGAHON MEIN", 25)}
            </p>
            <p className="text-gray-400 text-sm truncate">UDIT NARAYAN</p>
            <p className="text-gray-400 text-sm truncate">GARV: PRIDE</p>
          </div>

          <span className="text-gray-400 text-sm ml-4">05:04</span>
        </li>
      </ul>
    </div>
  );
}
