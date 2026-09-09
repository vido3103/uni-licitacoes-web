"use client";

interface TopMenuProps {
  active: string;
  setActive: (menu: string) => void;
}

export default function TopMenu({
  active,
  setActive,
}: TopMenuProps) {

  const menus = [
    "Dashboard",
    "Radar",
    "Editais",
    "CFP",
    "Gate Econômico",
    "Disputa",
    "Relatórios",
  ];

  return (
    <nav className="w-full bg-slate-950 text-white px-6 py-4 flex gap-3">

      {menus.map((menu) => (

        <button
          key={menu}
          onClick={() => setActive(menu)}
          className={`
            px-4 py-2 rounded-lg
            transition
            ${
              active === menu
              ? "bg-blue-600"
              : "bg-slate-800 hover:bg-slate-700"
            }
          `}
        >

          {menu}

        </button>

      ))}

    </nav>
  );
}