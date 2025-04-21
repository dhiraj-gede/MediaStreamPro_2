import React from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Home, 
  FolderOpen, 
  Video, 
  ListChecks, 
  Database 
} from 'lucide-react';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ 
  href, 
  icon, 
  children, 
  isActive, 
  onClick 
}) => {
  return (
    <li className={`px-4 py-2 hover:bg-gray-100 ${isActive ? 'text-primary font-medium' : ''}`}>
      <Link href={href} onClick={onClick}>
        <a className="flex items-center space-x-2">
          {icon}
          <span>{children}</span>
        </a>
      </Link>
    </li>
  );
};

interface SidebarProps {
  closeMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ closeMobile }) => {
  const [location] = useLocation();
  
  // Fetch folders from API
  const { data: folders = [] } = useQuery({
    queryKey: ['/api/folders'],
    initialData: []
  });

  return (
    <nav className="py-4">
      <ul>
        <NavItem 
          href="/dashboard" 
          icon={<Home className="h-5 w-5" />} 
          isActive={location === '/'} 
          onClick={closeMobile}
        >
          Dashboard
        </NavItem>
        <NavItem 
          href="/files" 
          icon={<FolderOpen className="h-5 w-5" />} 
          isActive={location === '/files'} 
          onClick={closeMobile}
        >
          Files
        </NavItem>
        <NavItem 
          href="/videos" 
          icon={<Video className="h-5 w-5" />} 
          isActive={location === '/videos'} 
          onClick={closeMobile}
        >
          Videos
        </NavItem>
        <NavItem 
          href="/jobs" 
          icon={<ListChecks className="h-5 w-5" />} 
          isActive={location === '/jobs'} 
          onClick={closeMobile}
        >
          Jobs
        </NavItem>
        <NavItem 
          href="/storage" 
          icon={<Database className="h-5 w-5" />} 
          isActive={location === '/storage'} 
          onClick={closeMobile}
        >
          Storage
        </NavItem>
      </ul>
      
      <div className="border-t my-4"></div>
      <div className="px-4">
        <h2 className="font-medium mb-2 text-muted-foreground text-sm">FOLDERS</h2>
        <ul>
          {folders.map((folder: any) => (
            <li 
              key={folder.id} 
              className="py-1.5 pl-2 hover:bg-gray-100 rounded-md cursor-pointer flex items-center space-x-2"
              onClick={closeMobile}
            >
              <span className="text-muted-foreground text-sm">folder</span>
              <span>{folder.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};
