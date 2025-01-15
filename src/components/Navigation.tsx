import React from 'react';
import Link from 'next/link';

const Navigation = () => {
  const menuItems = ['Riken', 'Home', 'Essay', 'Current Work', 'Experience', 'About Me'];
  
  return (
    <nav className="nav-blur">
      <div className="container">
        <div className="flex items-center h-[38px] relative">
          {/* Traffic Light Buttons */}
          <div className="absolute left-3 flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57] border border-[#E0443E] hover:brightness-90 transition-all duration-200 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] hover:brightness-90 transition-all duration-200 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-[#28C840] border border-[#1AAB29] hover:brightness-90 transition-all duration-200 cursor-pointer" />
          </div>
          
          {/* Title Bar */}
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center space-x-6">
              {menuItems.map((item, index) => (
                <Link
                  key={item}
                  href="#"
                  className={`text-[13px] transition-colors duration-200 ${
                    index === 0 
                      ? 'font-semibold text-black' 
                      : 'text-black/60 hover:text-black'
                  }`}
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Right side spacing to match left side */}
          <div className="w-[76px]" />
        </div>
      </div>
    </nav>
  );
};

export default Navigation; 