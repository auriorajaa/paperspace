import React from "react";
import {
  FolderIcon,
  BookOpenIcon,
  BookIcon,
  FileTextIcon,
  LayersIcon,
  DatabaseIcon,
  CodeIcon,
  TerminalIcon,
  BriefcaseIcon,
  BuildingIcon,
  HomeIcon,
  RocketIcon,
  TargetIcon,
  TrophyIcon,
  ShieldIcon,
  ZapIcon,
  HeartIcon,
  StarIcon,
  BookmarkIcon,
  TagIcon,
  ArchiveIcon,
  BoxIcon,
  PackageIcon,
  HardDriveIcon,
  GlobeIcon,
  MailIcon,
  BellIcon,
  LockIcon,
  FlagIcon,
  ClipboardIcon,
  CameraIcon,
  MusicIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react";

type CollectionIcon = {
  Icon: React.ElementType<any>;
  key: string;
  label: string;
};

export const COLLECTION_ICONS: CollectionIcon[] = [
  { Icon: FolderIcon, key: "folder", label: "Folder" },
  { Icon: BookOpenIcon, key: "book-open", label: "Book Open" },
  { Icon: BookIcon, key: "book", label: "Book" },
  { Icon: FileTextIcon, key: "file-text", label: "Document" },
  { Icon: LayersIcon, key: "layers", label: "Layers" },
  { Icon: DatabaseIcon, key: "database", label: "Database" },
  { Icon: CodeIcon, key: "code", label: "Code" },
  { Icon: TerminalIcon, key: "terminal", label: "Terminal" },
  { Icon: BriefcaseIcon, key: "briefcase", label: "Work" },
  { Icon: BuildingIcon, key: "building", label: "Company" },
  { Icon: HomeIcon, key: "home", label: "Personal" },
  { Icon: RocketIcon, key: "rocket", label: "Launch" },
  { Icon: TargetIcon, key: "target", label: "Goals" },
  { Icon: TrophyIcon, key: "trophy", label: "Achievements" },
  { Icon: ShieldIcon, key: "shield", label: "Security" },
  { Icon: ZapIcon, key: "zap", label: "Fast" },
  { Icon: HeartIcon, key: "heart", label: "Favorites" },
  { Icon: StarIcon, key: "star", label: "Important" },
  { Icon: BookmarkIcon, key: "bookmark", label: "Saved" },
  { Icon: TagIcon, key: "tag", label: "Tagged" },
  { Icon: ArchiveIcon, key: "archive", label: "Archive" },
  { Icon: BoxIcon, key: "box", label: "Box" },
  { Icon: PackageIcon, key: "package", label: "Package" },
  { Icon: HardDriveIcon, key: "hard-drive", label: "Storage" },
  { Icon: GlobeIcon, key: "globe", label: "Web" },
  { Icon: MailIcon, key: "mail", label: "Email" },
  { Icon: BellIcon, key: "bell", label: "Notifications" },
  { Icon: LockIcon, key: "lock", label: "Private" },
  { Icon: FlagIcon, key: "flag", label: "Flagged" },
  { Icon: ClipboardIcon, key: "clipboard", label: "Tasks" },
  { Icon: CameraIcon, key: "camera", label: "Media" },
  { Icon: MusicIcon, key: "music", label: "Music" },
  { Icon: SunIcon, key: "sun", label: "Sun" },
  { Icon: MoonIcon, key: "moon", label: "Moon" },
];

export function getIconComponent(key: string): React.ElementType<any> {
  return COLLECTION_ICONS.find((i) => i.key === key)?.Icon ?? FolderIcon;
}
