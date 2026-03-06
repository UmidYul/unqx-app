import {
  Briefcase,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Phone,
  Send,
} from 'lucide-react-native';

export const BUTTON_ICONS = [
  { key: 'phone', label: 'Phone', Icon: Phone },
  { key: 'send', label: 'Telegram', Icon: Send },
  { key: 'globe', label: 'Website', Icon: Globe },
  { key: 'mail', label: 'Email', Icon: Mail },
  { key: 'ig', label: 'Instagram', Icon: Instagram },
  { key: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { key: 'briefcase', label: 'Portfolio', Icon: Briefcase },
  { key: 'chat', label: 'Chat', Icon: MessageCircle },
] as const;

export type ButtonIconKey = (typeof BUTTON_ICONS)[number]['key'];

export function findButtonIcon(key: string) {
  return BUTTON_ICONS.find((item) => item.key === key) ?? BUTTON_ICONS[0];
}
