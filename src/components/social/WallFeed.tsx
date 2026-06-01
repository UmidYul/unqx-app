import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Edit3, Heart, MessageCircle, SendHorizontal, Share2, Trash2 } from 'lucide-react-native';

import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ViewerCommentComposer, WallComment, WallPagination, WallPost } from '@/types';

import { SocialAvatar, SocialPalette, SocialVerifiedIcon, formatSocialDate } from './primitives';

export interface WallAuthor {
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  initials?: string;
  verified?: boolean;
}

export interface WallFeedText {
  emptyTitle: string;
  emptySubtitle: string;
  loadMore: string;
  loadingMore: string;
  like: string;
  liked: string;
  comments: string;
  noComments: string;
  commentPlaceholder: string;
  sendComment: string;
  sendingComment: string;
  share: string;
  edit: string;
  delete: string;
  edited: string;
}

interface PostComposerProps {
  palette: SocialPalette;
  text: {
    placeholder: string;
    submit: string;
    submitting: string;
    cancel: string;
    hint: string;
  };
  value: string;
  limit: number;
  busy?: boolean;
  editing?: boolean;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}

interface WallCommentsProps {
  comments: WallComment[];
  locale: string;
  palette: SocialPalette;
  noCommentsText: string;
  deleteText: string;
  busyCommentIds?: Record<string, boolean>;
  onDeleteComment?: (comment: WallComment) => void;
}

interface WallPostCardProps {
  post: WallPost;
  author: WallAuthor;
  locale: string;
  palette: SocialPalette;
  text: WallFeedText;
  commentComposer?: ViewerCommentComposer | null;
  defaultCommentsOpen?: boolean;
  busyPostIds?: Record<string, boolean>;
  busyCommentIds?: Record<string, boolean>;
  onToggleLike?: (post: WallPost) => void;
  onShare?: (post: WallPost) => void;
  onEditPost?: (post: WallPost) => void;
  onDeletePost?: (post: WallPost) => void;
  onSubmitComment?: (post: WallPost, content: string) => Promise<void> | void;
  onDeleteComment?: (post: WallPost, comment: WallComment) => void;
}

interface WallFeedProps {
  items: WallPost[];
  pagination?: WallPagination;
  locale: string;
  palette: SocialPalette;
  text: WallFeedText;
  author: WallAuthor;
  commentComposer?: ViewerCommentComposer | null;
  openCommentsPostIds?: string[];
  loadingMore?: boolean;
  busyPostIds?: Record<string, boolean>;
  busyCommentIds?: Record<string, boolean>;
  onLoadMore?: () => void;
  onToggleLike?: (post: WallPost) => void;
  onShare?: (post: WallPost) => void;
  onEditPost?: (post: WallPost) => void;
  onDeletePost?: (post: WallPost) => void;
  onSubmitComment?: (post: WallPost, content: string) => Promise<void> | void;
  onDeleteComment?: (post: WallPost, comment: WallComment) => void;
}

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function PostComposer({
  palette,
  text,
  value,
  limit,
  busy,
  editing,
  onChangeText,
  onSubmit,
  onCancel,
}: PostComposerProps): React.JSX.Element {
  const remaining = Math.max(0, limit - value.length);

  return (
    <View style={[styles.composer, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={text.placeholder}
        placeholderTextColor={palette.mutedText}
        style={[styles.composerInput, { color: palette.text, backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
        multiline
        maxLength={limit}
        textAlignVertical='top'
      />
      <View style={styles.composerFooter}>
        <Text style={[styles.composerHint, { color: palette.mutedText }]}>
          {editing ? text.hint : `${remaining}/${limit}`}
        </Text>
        <View style={styles.composerActions}>
          {editing && onCancel ? (
            <AnimatedPressable
              style={[styles.secondaryComposerButton, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
              disabled={busy}
              onPress={onCancel}
            >
              <Text style={[styles.secondaryComposerText, { color: palette.text }]}>{text.cancel}</Text>
            </AnimatedPressable>
          ) : null}
          <AnimatedPressable
            style={[
              styles.primaryComposerButton,
              {
                backgroundColor: palette.accent,
                borderColor: palette.accent,
                opacity: busy ? 0.7 : 1,
              },
            ]}
            disabled={busy}
            onPress={onSubmit}
          >
            {busy ? (
              <ActivityIndicator size='small' color={palette.accentText} />
            ) : (
              <Text style={[styles.primaryComposerText, { color: palette.accentText }]}>
                {editing ? text.submit : text.submit}
              </Text>
            )}
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

export function WallComments({
  comments,
  locale,
  palette,
  noCommentsText,
  deleteText,
  busyCommentIds,
  onDeleteComment,
}: WallCommentsProps): React.JSX.Element {
  if (comments.length === 0) {
    return (
      <View style={[styles.emptyComments, { borderColor: palette.border, backgroundColor: palette.surfaceAlt }]}>
        <Text style={[styles.emptyCommentsText, { color: palette.mutedText }]}>{noCommentsText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.commentsList}>
      {comments.map((comment) => {
        const busy = Boolean(busyCommentIds?.[comment.id]);
        return (
          <View key={comment.id} style={[styles.commentCard, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
            <View style={styles.commentHead}>
              <View style={styles.commentAuthorRow}>
                <SocialAvatar
                  name={comment.author.name}
                  initials={comment.author.initials}
                  avatarUrl={comment.author.avatarUrl}
                  size={30}
                  palette={palette}
                />
                <View style={styles.commentMeta}>
                  <View style={styles.commentNameLine}>
                    <Text style={[styles.commentName, { color: palette.text }]} numberOfLines={1}>
                      {comment.author.name}
                    </Text>
                    {comment.author.verified ? <SocialVerifiedIcon color={palette.accent} size={12} /> : null}
                  </View>
                  <Text style={[styles.commentTime, { color: palette.mutedText }]}>
                    {formatSocialDate(comment.createdAt, locale)}
                  </Text>
                </View>
              </View>
              {comment.viewerCanDelete && onDeleteComment ? (
                <AnimatedPressable
                  style={[styles.iconButton, { backgroundColor: palette.surface, borderColor: palette.border, opacity: busy ? 0.7 : 1 }]}
                  disabled={busy}
                  onPress={() => onDeleteComment(comment)}
                >
                  {busy ? (
                    <ActivityIndicator size='small' color={palette.danger} />
                  ) : (
                    <>
                      <Trash2 size={14} strokeWidth={1.7} color={palette.danger} />
                      <Text style={[styles.iconButtonText, { color: palette.danger }]}>{deleteText}</Text>
                    </>
                  )}
                </AnimatedPressable>
              ) : null}
            </View>
            <Text style={[styles.commentContent, { color: palette.text }]}>{comment.content}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function WallPostCard({
  post,
  author,
  locale,
  palette,
  text,
  commentComposer,
  defaultCommentsOpen,
  busyPostIds,
  busyCommentIds,
  onToggleLike,
  onShare,
  onEditPost,
  onDeletePost,
  onSubmitComment,
  onDeleteComment,
}: WallPostCardProps): React.JSX.Element {
  const [commentsOpen, setCommentsOpen] = React.useState(Boolean(defaultCommentsOpen));
  const [draft, setDraft] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const postBusy = Boolean(busyPostIds?.[post.id]);

  React.useEffect(() => {
    if (defaultCommentsOpen) {
      setCommentsOpen(true);
    }
  }, [defaultCommentsOpen]);

  const handleSubmitComment = React.useCallback(async () => {
    const value = draft.trim();
    if (!value || !onSubmitComment) {
      return;
    }

    try {
      setSubmitting(true);
      await Promise.resolve(onSubmitComment(post, value));
      setDraft('');
      setCommentsOpen(true);
    } finally {
      setSubmitting(false);
    }
  }, [draft, onSubmitComment, post]);

  return (
    <View style={[styles.postCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.postHead}>
        <View style={styles.postAuthor}>
          <SocialAvatar
            name={author.name}
            initials={author.initials}
            avatarUrl={author.avatarUrl}
            size={46}
            palette={palette}
          />
          <View style={styles.postMeta}>
            <View style={styles.postNameLine}>
              <Text style={[styles.postName, { color: palette.text }]} numberOfLines={1}>
                {author.name}
              </Text>
              {author.verified ? <SocialVerifiedIcon color={palette.accent} /> : null}
            </View>
            <Text style={[styles.postSub, { color: palette.mutedText }]} numberOfLines={1}>
              {author.subtitle || 'UNQX'}
            </Text>
            <Text style={[styles.postTime, { color: palette.mutedText }]} numberOfLines={1}>
              {formatSocialDate(post.createdAt, locale)}
              {post.isEdited ? ` · ${text.edited}` : ''}
            </Text>
          </View>
        </View>

        {(onEditPost || onDeletePost) ? (
          <View style={styles.ownerActions}>
            {onEditPost ? (
              <AnimatedPressable
                style={[styles.iconButton, { backgroundColor: palette.surfaceAlt, borderColor: palette.border, opacity: postBusy ? 0.7 : 1 }]}
                disabled={postBusy}
                onPress={() => onEditPost(post)}
              >
                <Edit3 size={14} strokeWidth={1.7} color={palette.text} />
                <Text style={[styles.iconButtonText, { color: palette.text }]}>{text.edit}</Text>
              </AnimatedPressable>
            ) : null}
            {onDeletePost ? (
              <AnimatedPressable
                style={[styles.iconButton, { backgroundColor: palette.surfaceAlt, borderColor: palette.border, opacity: postBusy ? 0.7 : 1 }]}
                disabled={postBusy}
                onPress={() => onDeletePost(post)}
              >
                {postBusy ? (
                  <ActivityIndicator size='small' color={palette.danger} />
                ) : (
                  <>
                    <Trash2 size={14} strokeWidth={1.7} color={palette.danger} />
                    <Text style={[styles.iconButtonText, { color: palette.danger }]}>{text.delete}</Text>
                  </>
                )}
              </AnimatedPressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <Text style={[styles.postContent, { color: palette.text }]}>{post.content}</Text>

      <View style={styles.actionRow}>
        <AnimatedPressable
          containerStyle={styles.actionCell}
          style={[
            styles.actionItem,
            {
              backgroundColor: post.viewerHasLiked ? palette.accentSoft : palette.surfaceAlt,
              borderColor: post.viewerHasLiked ? palette.accent : palette.border,
              opacity: postBusy || !post.viewerCanLike ? 0.65 : 1,
            },
          ]}
          disabled={postBusy || !post.viewerCanLike || !onToggleLike}
          onPress={() => onToggleLike?.(post)}
        >
          <Heart
            size={15}
            strokeWidth={1.8}
            color={post.viewerHasLiked ? palette.accent : palette.text}
            fill={post.viewerHasLiked ? palette.accent : 'none'}
          />
          <Text style={[styles.actionLabel, { color: post.viewerHasLiked ? palette.accent : palette.text }]}>
            {`${formatCount(post.likesCount, locale)} ${post.viewerHasLiked ? text.liked : text.like}`}
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          containerStyle={styles.actionCell}
          style={[styles.actionItem, { backgroundColor: commentsOpen ? palette.accentSoft : palette.surfaceAlt, borderColor: commentsOpen ? palette.accent : palette.border }]}
          onPress={() => setCommentsOpen((prev) => !prev)}
        >
          <MessageCircle size={15} strokeWidth={1.8} color={commentsOpen ? palette.accent : palette.text} />
          <Text style={[styles.actionLabel, { color: commentsOpen ? palette.accent : palette.text }]}>
            {`${formatCount(post.commentsCount, locale)} ${text.comments}`}
          </Text>
        </AnimatedPressable>

        {onShare ? (
          <AnimatedPressable
            containerStyle={styles.actionCell}
            style={[styles.actionItem, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
            onPress={() => onShare(post)}
          >
            <Share2 size={15} strokeWidth={1.8} color={palette.text} />
            <Text style={[styles.actionLabel, { color: palette.text }]}>{text.share}</Text>
          </AnimatedPressable>
        ) : null}
      </View>

      {commentsOpen ? (
        <View style={styles.commentsBlock}>
          <WallComments
            comments={post.comments}
            locale={locale}
            palette={palette}
            noCommentsText={text.noComments}
            deleteText={text.delete}
            busyCommentIds={busyCommentIds}
            onDeleteComment={onDeleteComment ? (comment) => onDeleteComment(post, comment) : undefined}
          />

          {post.commentsEnabled && onSubmitComment ? (
            <View style={[styles.commentComposer, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
              <SocialAvatar
                name={author.name}
                initials={commentComposer?.initials ?? author.initials}
                avatarUrl={commentComposer?.avatarUrl ?? author.avatarUrl}
                size={34}
                palette={palette}
              />
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={commentComposer?.placeholder || text.commentPlaceholder}
                placeholderTextColor={palette.mutedText}
                style={[styles.commentInput, { color: palette.text }]}
                multiline
                textAlignVertical='center'
              />
              <AnimatedPressable
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: palette.accent,
                    borderColor: palette.accent,
                    opacity: submitting || postBusy ? 0.7 : 1,
                  },
                ]}
                disabled={submitting || postBusy}
                onPress={() => {
                  void handleSubmitComment();
                }}
              >
                {submitting ? (
                  <ActivityIndicator size='small' color={palette.accentText} />
                ) : (
                  <>
                    <SendHorizontal size={14} strokeWidth={1.8} color={palette.accentText} />
                    <Text style={[styles.sendText, { color: palette.accentText }]}>{text.sendComment}</Text>
                  </>
                )}
              </AnimatedPressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function WallFeed({
  items,
  pagination,
  locale,
  palette,
  text,
  author,
  commentComposer,
  openCommentsPostIds,
  loadingMore,
  busyPostIds,
  busyCommentIds,
  onLoadMore,
  onToggleLike,
  onShare,
  onEditPost,
  onDeletePost,
  onSubmitComment,
  onDeleteComment,
}: WallFeedProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <View style={[styles.emptyFeed, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.emptyTitle, { color: palette.text }]}>{text.emptyTitle}</Text>
        <Text style={[styles.emptySubtitle, { color: palette.mutedText }]}>{text.emptySubtitle}</Text>
      </View>
    );
  }

  return (
    <View style={styles.feed}>
      {items.map((post) => (
        <WallPostCard
          key={post.id}
          post={post}
          author={author}
          locale={locale}
          palette={palette}
          text={text}
          commentComposer={commentComposer}
          defaultCommentsOpen={Boolean(openCommentsPostIds?.includes(post.id))}
          busyPostIds={busyPostIds}
          busyCommentIds={busyCommentIds}
          onToggleLike={onToggleLike}
          onShare={onShare}
          onEditPost={onEditPost}
          onDeletePost={onDeletePost}
          onSubmitComment={onSubmitComment}
          onDeleteComment={onDeleteComment}
        />
      ))}

      {pagination?.hasMore && onLoadMore ? (
        <AnimatedPressable
          style={[styles.moreButton, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}
          disabled={loadingMore}
          onPress={onLoadMore}
        >
          {loadingMore ? (
            <ActivityIndicator size='small' color={palette.accent} />
          ) : (
            <Text style={[styles.moreText, { color: palette.text }]}>{text.loadMore}</Text>
          )}
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  feed: {
    gap: 14,
  },
  emptyFeed: {
    minHeight: 180,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  composer: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  composerInput: {
    minHeight: 132,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  composerHint: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryComposerButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryComposerText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  primaryComposerButton: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryComposerText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  postCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  postHead: {
    gap: 12,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  postMeta: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  postNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  postSub: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  postTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  ownerActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginLeft: 58,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: 'Inter_400Regular',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionCell: {
    flexGrow: 1,
    minWidth: 0,
  },
  actionItem: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  commentsBlock: {
    gap: 12,
  },
  emptyComments: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emptyCommentsText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  commentsList: {
    gap: 10,
  },
  commentCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  commentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentAuthorRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentMeta: {
    flex: 1,
    gap: 2,
  },
  commentNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  commentName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  commentTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  commentContent: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  commentComposer: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    maxHeight: 94,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 0,
  },
  sendButton: {
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sendText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  iconButton: {
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconButtonText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  moreButton: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
});
