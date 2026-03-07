import React from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Check, Pencil } from 'lucide-react-native';

import { SkeletonBlock } from '@/components/ui/skeleton';
import { Label, Pill, Row } from '@/components/ui/shared';
import { useLanguageContext } from '@/i18n/LanguageProvider';
import { NFCHistoryItem, ThemeTokens, WristbandOrder, WristbandStatus } from '@/types';
import { runThrottled } from '@/utils/navigation';

interface WristbandTag {
  uid: string;
  name: string;
  linkedSlug?: string;
  status?: string;
}

interface WristbandPageProps {
  visible: boolean;
  onClose: () => void;
  tokens: ThemeTokens;
  status: WristbandStatus | null;
  tags: WristbandTag[];
  history: NFCHistoryItem[];
  loading: boolean;
  orders: WristbandOrder[];
  selectedOrderId?: string | null;
  orderStatus: WristbandOrder | null;
  autoOpenOrderId?: string | null;
  onAutoOpenHandled?: () => void;
  onRenameTag: (uid: string, name: string) => void;
  onDeleteTag: (uid: string) => void;
  onCreateOrder: (payload: { address: string; quantity: number }) => void;
  onTrackOrder: (orderId: string) => void;
  renamePending: boolean;
  deletePendingUid?: string | null;
  orderPending: boolean;
}

type OrderStep = null | 'form' | 'orders' | 'tracking';

function formatTapTime(value?: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '—';
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveOrderStage(status?: string | null): number {
  const value = String(status ?? '').trim().toLowerCase();
  if (value === 'approved' || value === 'done' || value === 'delivered') return 4;
  if (value === 'paid' || value === 'confirmed') return 1;
  if (value === 'new' || value === 'contacted' || value === 'rejected' || value === 'expired') return 0;
  return 0;
}

function getOrderStatusBadge(status?: string): string {
  const value = String(status ?? '').trim().toLowerCase();
  if (value === 'new') return 'Новая';
  if (value === 'contacted') return 'Связались';
  if (value === 'paid' || value === 'confirmed') return 'Оплачено';
  if (value === 'approved' || value === 'done' || value === 'delivered') return 'Активировано';
  if (value === 'rejected' || value === 'expired') return 'Отклонено';
  return 'В обработке';
}

function formatOrderDate(value?: string): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function WristbandPage({
  visible,
  onClose,
  tokens,
  status,
  tags,
  history,
  loading,
  orders,
  selectedOrderId,
  orderStatus,
  autoOpenOrderId,
  onAutoOpenHandled,
  onRenameTag,
  onDeleteTag,
  onCreateOrder,
  onTrackOrder,
  renamePending,
  deletePendingUid,
  orderPending,
}: WristbandPageProps): React.JSX.Element {
  const isIos = Platform.OS === 'ios';
  const { language } = useLanguageContext();
  const isUz = language === 'uz';
  const [orderStep, setOrderStep] = React.useState<OrderStep>(null);
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);
  const [editTag, setEditTag] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [qty, setQty] = React.useState('1');

  React.useEffect(() => {
    if (!visible) {
      setOrderStep(null);
      setSelectedTag(null);
      setEditTag(null);
      setEditName('');
    }
  }, [visible]);

  React.useEffect(() => {
    if (selectedTag && !tags.some((item) => item.uid === selectedTag)) {
      setSelectedTag(null);
    }
  }, [selectedTag, tags]);

  const selected = selectedTag ? tags.find((item) => item.uid === selectedTag) : null;
  const selectedHistory = React.useMemo(
    () => (selectedTag ? history.filter((item) => item.uid === selectedTag) : []),
    [history, selectedTag],
  );
  const linkedSlug = String(status?.linkedSlug ?? '').trim();
  const overallLastTap = history[0]?.timestamp;
  const activeOrder = React.useMemo(() => {
    if (orderStatus?.id) {
      const fromList = orders.find((item) => item.id === orderStatus.id);
      return {
        ...fromList,
        ...orderStatus,
      };
    }
    if (!selectedOrderId) {
      return null;
    }
    return orders.find((item) => item.id === selectedOrderId) ?? null;
  }, [orderStatus, orders, selectedOrderId]);
  const orderStage = resolveOrderStage(activeOrder?.status);

  React.useEffect(() => {
    if (!visible || !autoOpenOrderId) {
      return;
    }
    onTrackOrder(autoOpenOrderId);
    setOrderStep('tracking');
    onAutoOpenHandled?.();
  }, [autoOpenOrderId, onAutoOpenHandled, onTrackOrder, visible]);

  const openPricingPage = React.useCallback(() => {
    void Linking.openURL('https://unqx.uz/#pricing').catch(() => undefined);
  }, []);

  const requestDeleteTag = React.useCallback(
    (uid: string, name: string) => {
      if (deletePendingUid) {
        return;
      }

      Alert.alert(
        isUz ? 'Tegni o\'chirilsinmi?' : 'Удалить метку?',
        isUz
          ? `${name} (${uid}) tegi qayta tiklab bo\'lmaydigan tarzda o\'chiriladi.`
          : `Метка ${name} (${uid}) будет удалена без возможности восстановления.`,
        [
          { text: isUz ? 'Bekor qilish' : 'Отмена', style: 'cancel' },
          {
            text: isUz ? 'O\'chirish' : 'Удалить',
            style: 'destructive',
            onPress: () => onDeleteTag(uid),
          },
        ],
      );
    },
    [deletePendingUid, isUz, onDeleteTag],
  );

  const orderSteps = [
    { label: 'Заявка принята', sub: 'Проверяем данные', done: Boolean(activeOrder?.id) },
    { label: 'Оплата подтверждена', sub: isIos ? 'Оплата на сайте unqx.uz' : 'Payme · 300 000 сум', done: orderStage >= 1 },
    { label: 'В сборке', sub: linkedSlug ? `Привязываем к ${linkedSlug}` : 'Привязываем к активному slug', done: orderStage >= 2 },
    { label: 'Передан в доставку', sub: 'Данные доставки от курьера', done: orderStage >= 3 },
    { label: 'Доставлен', sub: 'Заказ успешно завершен', done: orderStage >= 4 },
  ];

  const Header = ({ title, back }: { title: string; back: () => void }) => (
    <View style={[styles.header, { borderBottomColor: tokens.border, backgroundColor: tokens.phoneBg }]}>
      <Pressable onPress={() => runThrottled(back)} style={styles.backBtn}>
        <ArrowLeft size={16} strokeWidth={1.5} color={tokens.textMuted} />
        <Text style={[styles.backText, { color: tokens.textMuted }]}>Назад</Text>
      </Pressable>
      <Text style={[styles.headerTitle, { color: tokens.text }]}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: tokens.phoneBg }]}>
        {selected ? (
          <>
            <Header title={selected.name} back={() => setSelectedTag(null)} />
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.card, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                <Row label='UID' value={selected.uid} textColor={tokens.text} mutedColor={tokens.textMuted} borderColor={tokens.border} />
                <Row
                  label='Привязан к'
                  value={selected.linkedSlug ? `unqx.uz/${selected.linkedSlug}` : linkedSlug ? `unqx.uz/${linkedSlug}` : '—'}
                  textColor={tokens.text}
                  mutedColor={tokens.textMuted}
                  borderColor={tokens.border}
                />
                <Row label='Тапов' value={`${selectedHistory.length}`} textColor={tokens.text} mutedColor={tokens.textMuted} borderColor={tokens.border} />
                <Row
                  label='Последний тап'
                  value={formatTapTime(selectedHistory[0]?.timestamp)}
                  textColor={tokens.text}
                  mutedColor={tokens.textMuted}
                  borderColor={tokens.border}
                  last
                />
              </View>

              <Label color={tokens.textMuted}>История записей на эту метку</Label>
              {selectedHistory.map((item) => (
                <View key={item.id} style={[styles.historyRow, { borderBottomColor: tokens.border }]}>
                  <View style={[styles.historyIcon, { backgroundColor: `${tokens.accent}14` }]}>
                    <Text style={[styles.historyIconText, { color: tokens.accent }]}>W</Text>
                  </View>
                  <View>
                    <Text style={[styles.historyName, { color: tokens.text }]}>{`unqx.uz/${item.slug}`}</Text>
                    <Text style={[styles.historyTime, { color: tokens.textMuted }]}>{formatTapTime(item.timestamp)}</Text>
                  </View>
                </View>
              ))}

              <Pressable
                style={[styles.dangerBtn, { borderColor: `${tokens.red}66`, backgroundColor: `${tokens.red}12`, opacity: deletePendingUid === selected.uid ? 0.6 : 1 }]}
                disabled={deletePendingUid === selected.uid}
                onPress={() => requestDeleteTag(selected.uid, selected.name)}
              >
                {deletePendingUid === selected.uid ? (
                  <ActivityIndicator size='small' color={tokens.red} />
                ) : (
                  <Text style={[styles.dangerBtnText, { color: tokens.red }]}>{isUz ? 'Tegni o\'chirish' : 'Удалить метку'}</Text>
                )}
              </Pressable>
            </ScrollView>
          </>
        ) : null}

        {orderStep === 'tracking' ? (
          <>
            <Header title='Статус заказа' back={() => setOrderStep('orders')} />
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.banner, { borderColor: `${tokens.amber}55`, backgroundColor: `${tokens.amber}14` }]}>
                <Text style={[styles.bannerTitle, { color: tokens.amber }]}>{activeOrder?.statusBadge || getOrderStatusBadge(activeOrder?.status)}</Text>
                <Text style={[styles.bannerSub, { color: tokens.textSub }]}>{activeOrder?.id ? `Заказ #${activeOrder.id}` : 'Статус заказа в обработке'}</Text>
              </View>

              {activeOrder ? (
                <View style={[styles.card, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                  <Row label='Создан' value={formatOrderDate(activeOrder.createdAt)} textColor={tokens.text} mutedColor={tokens.textMuted} borderColor={tokens.border} />
                  <Row label='Статус' value={activeOrder.statusBadge || getOrderStatusBadge(activeOrder.status)} textColor={tokens.text} mutedColor={tokens.textMuted} borderColor={tokens.border} />
                  <Row label='Slug' value={activeOrder.slug || linkedSlug || '—'} textColor={tokens.text} mutedColor={tokens.textMuted} borderColor={tokens.border} />
                  <Row
                    label='Примечание'
                    value={activeOrder.adminNote || '—'}
                    textColor={tokens.text}
                    mutedColor={tokens.textMuted}
                    borderColor={tokens.border}
                    last
                  />
                </View>
              ) : null}

              {orderSteps.map((step, index) => (
                <View key={step.label} style={styles.stepRow}>
                  <View style={styles.stepLineCol}>
                    <View style={[styles.stepDot, { borderColor: step.done ? tokens.green : tokens.border, backgroundColor: step.done ? tokens.green : tokens.surface }]}>
                      {step.done ? <Check size={10} strokeWidth={2} color='#fff' /> : null}
                    </View>
                    {index < orderSteps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: step.done ? tokens.green : tokens.border }]} /> : null}
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepTitle, { color: step.done ? tokens.text : tokens.textMuted }]}>{step.label}</Text>
                    <Text style={[styles.stepSub, { color: tokens.textMuted }]}>{step.sub}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        {orderStep === 'orders' ? (
          <>
            <Header title='Мои заказы' back={() => setOrderStep(null)} />
            <ScrollView contentContainerStyle={styles.content}>
              {orders.length === 0 ? (
                <View style={[styles.card, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                  <Text style={[styles.orderSub, { color: tokens.textMuted }]}>Заказов пока нет</Text>
                </View>
              ) : (
                orders.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.orderRowCard, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
                    onPress={() => {
                      onTrackOrder(item.id);
                      setOrderStep('tracking');
                    }}
                  >
                    <View style={styles.orderTop}>
                      <Text style={[styles.orderName, { color: tokens.text }]}>{`Заказ #${item.id}`}</Text>
                      <Text style={[styles.orderPrice, { color: tokens.textMuted }]}>{item.statusBadge || getOrderStatusBadge(item.status)}</Text>
                    </View>
                    <Text style={[styles.orderSub, { color: tokens.textMuted }]}>
                      {`${item.slug || linkedSlug || 'UNQ'} · ${formatOrderDate(item.createdAt)}`}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </>
        ) : null}

        {orderStep === 'form' ? (
          <>
            <Header title='Заказ браслета' back={() => setOrderStep(null)} />
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.card, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                <View style={styles.orderTop}>
                  <Text style={[styles.orderName, { color: tokens.text }]}>UNQX Wristband</Text>
                  <Text style={[styles.orderPrice, { color: tokens.text }]}>300 000 сум</Text>
                </View>
                <Text style={[styles.orderSub, { color: tokens.textMuted }]}>NFC-браслет · Тканевый · Привязывается к {linkedSlug || 'активному slug'}</Text>
              </View>

              {isIos ? (
                <>
                  <View style={[styles.blueInfo, { borderColor: `${tokens.blue}55`, backgroundColor: `${tokens.blue}14` }]}>
                    <Text style={[styles.blueTitle, { color: tokens.blue }]}>Оформление на сайте</Text>
                    <Text style={[styles.blueText, { color: tokens.textSub }]}>Для оформления заказа и оплаты перейдите на официальный сайт UNQX.</Text>
                  </View>

                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: tokens.accent }]}
                    onPress={openPricingPage}
                  >
                    <Text style={[styles.primaryBtnText, { color: tokens.accentText }]}>Открыть unqx.uz</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Field label='Адрес доставки' value={address} onChangeText={setAddress} tokens={tokens} />
                  <Field label='Количество' value={qty} onChangeText={setQty} tokens={tokens} keyboardType='number-pad' />

                  <View style={[styles.blueInfo, { borderColor: `${tokens.blue}55`, backgroundColor: `${tokens.blue}14` }]}>
                    <Text style={[styles.blueTitle, { color: tokens.blue }]}>После оплаты</Text>
                    <Text style={[styles.blueText, { color: tokens.textSub }]}>Мы напишем в Telegram и отправим реквизиты Payme или Click. Активация в течение 15 мин.</Text>
                  </View>

                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: tokens.accent, opacity: orderPending ? 0.5 : 1 }]}
                    disabled={orderPending || !address.trim()}
                    onPress={() => {
                      onCreateOrder({ address: address.trim(), quantity: Math.max(1, Number(qty) || 1) });
                      setOrderStep('orders');
                    }}
                  >
                    {orderPending ? (
                      <ActivityIndicator color={tokens.accentText} />
                    ) : (
                      <Text style={[styles.primaryBtnText, { color: tokens.accentText }]}>Отправить заявку</Text>
                    )}
                  </Pressable>
                </>
              )}
            </ScrollView>
          </>
        ) : null}

        {!selected && !orderStep ? (
          <>
            <Header title='Браслет и метки' back={onClose} />
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.activeCard, { borderColor: `${tokens.green}55`, backgroundColor: `${tokens.green}14` }]}>
                <View style={styles.activeLeft}>
                  <View style={[styles.deviceIcon, { backgroundColor: tokens.greenBg }]}>
                    <Text style={styles.deviceGlyph}>NFC</Text>
                  </View>
                  <View>
                    {loading ? <SkeletonBlock tokens={tokens} height={12} width={110} /> : <Text style={[styles.activeTitle, { color: tokens.text }]}>Браслет активен</Text>}
                    {loading ? (
                      <SkeletonBlock tokens={tokens} height={10} width={150} style={{ marginTop: 4 }} />
                    ) : (
                      <Text style={[styles.activeSub, { color: tokens.textMuted }]}>{`${linkedSlug || '—'} · последний тап ${formatTapTime(overallLastTap)}`}</Text>
                    )}
                  </View>
                </View>
                <Pill color={tokens.green} bg={tokens.greenBg}>● Активен</Pill>
              </View>

              <Label color={tokens.textMuted}>{`Мои метки (${tags.length})`}</Label>
              {tags.map((tag) => (
                <View key={tag.uid} style={[styles.tagCard, { borderColor: tag.status === 'warn' ? tokens.amber : tokens.border, backgroundColor: tokens.surface }]}>
                  <View style={styles.tagHead}>
                    <View>
                      {editTag === tag.uid ? (
                        <View style={styles.editRow}>
                          <TextInput
                            value={editName}
                            onChangeText={setEditName}
                            onSubmitEditing={() => {
                              if (renamePending || !editName.trim()) {
                                return;
                              }
                              onRenameTag(tag.uid, editName);
                              setEditTag(null);
                            }}
                            style={[styles.editInput, { borderColor: tokens.borderStrong, color: tokens.text, backgroundColor: tokens.phoneBg }]}
                          />
                          <Pressable
                            style={[styles.okBtn, { backgroundColor: tokens.accent, opacity: renamePending || !editName.trim() ? 0.5 : 1 }]}
                            disabled={renamePending || !editName.trim()}
                            onPress={() => {
                              onRenameTag(tag.uid, editName);
                              setEditTag(null);
                            }}
                          >
                            {renamePending ? (
                              <ActivityIndicator color={tokens.accentText} />
                            ) : (
                              <Text style={[styles.okText, { color: tokens.accentText }]}>OK</Text>
                            )}
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.tagNameRow}>
                          <Text style={[styles.tagName, { color: tokens.text }]}>{tag.name}</Text>
                          <Pressable
                            onPress={() => {
                              setEditTag(tag.uid);
                              setEditName(tag.name);
                            }}
                            style={styles.tagEditBtn}
                          >
                            <Pencil size={12} strokeWidth={1.5} color={tokens.textMuted} />
                          </Pressable>
                        </View>
                      )}
                      <Text style={[styles.tagUid, { color: tokens.textMuted }]}>{tag.uid}</Text>
                    </View>
                    {tag.status === 'warn' ? <Pill color={tokens.amber} bg={tokens.amberBg}>Давно не тапали</Pill> : null}
                  </View>

                  <View style={styles.tagFoot}>
                    <Text style={[styles.tagMeta, { color: tokens.textMuted }]}>
                      {`${history.filter((item) => item.uid === tag.uid).length} тапов · ${formatTapTime(history.find((item) => item.uid === tag.uid)?.timestamp)}`}
                    </Text>
                    <View style={styles.tagActions}>
                      <Pressable style={[styles.historyBtn, { borderColor: tokens.border }]} onPress={() => setSelectedTag(tag.uid)}>
                        <Text style={[styles.historyBtnText, { color: tokens.text }]}>История →</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.historyBtn, { borderColor: `${tokens.red}66`, opacity: deletePendingUid === tag.uid ? 0.5 : 1 }]}
                        disabled={deletePendingUid === tag.uid}
                        onPress={() => requestDeleteTag(tag.uid, tag.name)}
                      >
                        {deletePendingUid === tag.uid ? (
                          <ActivityIndicator size='small' color={tokens.red} />
                        ) : (
                          <Text style={[styles.historyBtnText, { color: tokens.red }]}>{isUz ? 'O\'chirish' : 'Удалить'}</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}

              <View style={[styles.divider, { backgroundColor: tokens.border }]} />
              <Label color={tokens.textMuted}>Заказать новый браслет</Label>

              <View style={[styles.card, { borderColor: tokens.border, backgroundColor: tokens.surface }]}>
                <View style={styles.orderTop}>
                  <Text style={[styles.orderName, { color: tokens.text }]}>UNQX Wristband</Text>
                  <Text style={[styles.orderPrice, { color: tokens.text }]}>300 000 сум</Text>
                </View>
                <Text style={[styles.orderSub, { color: tokens.textMuted }]}>Тканевый NFC-браслет · Разовая покупка · Доставка по Ташкенту</Text>
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: tokens.accent, opacity: orderPending ? 0.5 : 1 }]}
                  disabled={orderPending}
                  onPress={() => {
                    if (isIos) {
                      openPricingPage();
                      return;
                    }
                    setOrderStep('form');
                  }}
                >
                  {orderPending ? (
                    <ActivityIndicator color={tokens.accentText} />
                  ) : (
                    <Text style={[styles.primaryBtnText, { color: tokens.accentText }]}>{isIos ? 'Открыть unqx.uz' : 'Заказать браслет'}</Text>
                  )}
                </Pressable>
              </View>

              <Pressable
                style={[styles.secondaryBtn, { borderColor: tokens.border, backgroundColor: tokens.surface }]}
                onPress={() => {
                  setOrderStep('orders');
                }}
              >
                <Text style={[styles.secondaryBtnText, { color: tokens.text }]}>{orders.length ? `Мои заказы (${orders.length}) →` : 'Мои заказы →'}</Text>
              </Pressable>
            </ScrollView>
          </>
        ) : null}
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  tokens,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  tokens: ThemeTokens;
  keyboardType?: 'default' | 'number-pad';
}): React.JSX.Element {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: tokens.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={label}
        placeholderTextColor={tokens.textMuted}
        style={[styles.fieldInput, { borderColor: tokens.border, backgroundColor: tokens.inputBg, color: tokens.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 72,
  },
  backText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  headerSpacer: {
    width: 72,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  activeCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  activeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceGlyph: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: '#111',
  },
  activeTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  activeSub: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  tagCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  tagHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  tagNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  tagEditBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagUid: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editInput: {
    minHeight: 34,
    minWidth: 160,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  okBtn: {
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  tagFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagMeta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  historyBtn: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 30,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBtnText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  dangerBtn: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dangerBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    height: 1,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  orderPrice: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  orderSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  primaryBtn: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryBtn: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  orderRowCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  historyRow: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIconText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  historyName: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  historyTime: {
    marginTop: 1,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 3,
  },
  bannerSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
  },
  stepLineCol: {
    alignItems: 'center',
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 2,
    height: 28,
    marginVertical: 2,
  },
  stepBody: {
    paddingBottom: 14,
  },
  stepTitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  stepSub: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  fieldBlock: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  fieldInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 13,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  blueInfo: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  blueTitle: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  blueText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
});
