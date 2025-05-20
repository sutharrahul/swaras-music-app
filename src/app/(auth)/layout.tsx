import LogoIcon from "@/assets/LogoIcon";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex m-10 ">
      <div>
        <div>
          <div>
            <div className="flex items-center gap-3">
              <LogoIcon className="w-9 sm:w-11" />
              <h1 className="text-xl font-semibold sm:text-4xl sm:font-bold">
                <span className="text-[#FF5656]">Swaras</span>Music
              </h1>
            </div>
            <div></div>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
