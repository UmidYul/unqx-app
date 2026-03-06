import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface ExportContact {
  name: string;
  slug: string;
  phone?: string;
  email?: string;
  telegram?: string;
  company?: string;
}

interface UseExportResult {
  exportVCF: (contacts: ExportContact[]) => Promise<string>;
  exportCSV: (contacts: ExportContact[]) => Promise<string>;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function buildVcf(contacts: ExportContact[]): string {
  return contacts
    .map((contact) => {
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${contact.name}`,
        `N:${contact.name};;;;`,
        contact.company ? `ORG:${contact.company}` : null,
        contact.phone ? `TEL;TYPE=CELL:${contact.phone}` : null,
        contact.email ? `EMAIL;TYPE=INTERNET:${contact.email}` : null,
        `URL:https://unqx.uz/${contact.slug}`,
        contact.telegram ? `X-SOCIALPROFILE;TYPE=telegram:https://t.me/${contact.telegram.replace('@', '')}` : null,
        'END:VCARD',
      ].filter(Boolean);

      return lines.join('\n');
    })
    .join('\n');
}

function buildCsv(contacts: ExportContact[]): string {
  const header = ['name', 'slug', 'phone', 'email', 'telegram', 'url'];
  const rows = contacts.map((contact) => [
    contact.name,
    contact.slug,
    contact.phone ?? '',
    contact.email ?? '',
    contact.telegram ?? '',
    `https://unqx.uz/${contact.slug}`,
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsv(String(value))).join(','))
    .join('\n');
}

async function shareContent(fileName: string, mimeType: string, content: string): Promise<void> {
  try {
    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType,
      dialogTitle: `Export ${fileName}`,
      UTI: mimeType,
    });
  } catch {
    // noop
  }
}

export function useExport(): UseExportResult {
  const exportVCF = async (contacts: ExportContact[]): Promise<string> => {
    const content = buildVcf(contacts);
    await shareContent('unqx-contacts.vcf', 'text/vcard', content);
    return content;
  };

  const exportCSV = async (contacts: ExportContact[]): Promise<string> => {
    const content = buildCsv(contacts);
    await shareContent('unqx-contacts.csv', 'text/csv', content);
    return content;
  };

  return {
    exportVCF,
    exportCSV,
  };
}
