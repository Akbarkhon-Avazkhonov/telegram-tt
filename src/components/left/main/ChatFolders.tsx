import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChatFolder, ApiChatlistExportedInvite, ApiMessageEntity,
  ApiMessageEntityCustomEmoji,
  ApiSession,
} from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import type { SettingsScreens } from '../../../types';
import type { MenuItemContextAction } from '../../ui/ListItem';
import type { TabWithProperties } from '../../ui/TabList';
import { ApiMessageEntityTypes } from '../../../api/types';
import { LeftColumnContent } from '../../../types';

import {
  ALL_FOLDER_ID, APP_NAME, DEBUG, IS_BETA,
} from '../../../config';
import { selectCanShareFolder, selectTabState } from '../../../global/selectors';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { captureEvents, SwipeDirection } from '../../../util/captureEvents';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { IS_ELECTRON, IS_MAC_OS, IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import renderText from '../../common/helpers/renderText';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';
import {
  BotIcon, ChannelIcon, ChatIcon, ChatsIcon, FolderIcon, GroupIcon, StarIcon, UserIcon,
} from '../settings/folders/icons/predifinedFolderIcons';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransition from '../../../hooks/useShowTransition';
import { useFullscreenStatus } from '../../../hooks/window/useFullscreen';
import useLeftHeaderButtonRtlForumTransition from './hooks/useLeftHeaderButtonRtlForumTransition';

import AnimatedCustomEmoji from '../../middle/message/AnimatedCustomEmoji';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import TabList from '../../ui/TabList';
import Transition from '../../ui/Transition';
import { PREDEFINED_ICONS } from '../settings/folders/FolderIconPicker';
import ChatList from './ChatList';
import LeftSideMenuItems from './LeftSideMenuItems';

type OwnProps = {
  onSettingsScreenSelect: (screen: SettingsScreens) => void;
  foldersDispatch: FolderEditDispatch;
  onLeftColumnContentChange: (content: LeftColumnContent) => void;
  shouldHideFolderTabs?: boolean;
  isForumPanelOpen?: boolean;
  content?: LeftColumnContent;
  shouldHideSearch?: boolean;
  shouldSkipTransition?: boolean;
  onSelectSettings?: NoneToVoidFunction;
  onSelectContacts?: NoneToVoidFunction;
  onSelectArchived?: NoneToVoidFunction;
  onSelectMessages?:NoneToVoidFunction;
  onReset?: NoneToVoidFunction;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  currentUserId?: string;
  shouldSkipHistoryAnimations?: boolean;
  maxFolders: number;
  maxChatLists: number;
  maxFolderInvites: number;
  hasArchivedChats?: boolean;
  hasArchivedStories?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  isStoryRibbonShown?: boolean;
  sessions?: Record<string, ApiSession>;
};

const SAVED_MESSAGES_HOTKEY = '0';
const FIRST_FOLDER_INDEX = 0;

function findFirstEmoji(text: string): string | undefined {
  // eslint-disable-next-line max-len
  const emojiRegex = /([\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/u;

  const match = text.match(emojiRegex);
  return match ? match[0] : undefined;
}

const getEmoticon = (id:number, emoticon:string | undefined, entities:ApiMessageEntity[] | undefined, title:string) => {
  if (id === ALL_FOLDER_ID) return <ChatsIcon className="folder-emoticon" />;

  if (entities && entities.length > 0) {
    const customEmoji = entities
      .find((ent) => ent.type === ApiMessageEntityTypes.CustomEmoji) as ApiMessageEntityCustomEmoji | undefined;
    if (customEmoji) {
      return <AnimatedCustomEmoji customEmojiId={customEmoji.documentId} />;
    }
  }

  // this is temporary code, until emojis (regular and custom) will be able to be placed in "emoticon" field or in "entities"
  // For now first emoji from title will be used
  const emojiFromTitle = findFirstEmoji(title);
  if (emojiFromTitle) {
    return <span className="emoji-emoticon">{renderText(emojiFromTitle, ['emoji'])[0]}</span>;
  }

  if (!emoticon) {
    return <FolderIcon className="folder-emoticon" />;
  }
  switch (emoticon) {
    case PREDEFINED_ICONS.CHATS:
      return <ChatsIcon className="folder-emoticon" />;
    case PREDEFINED_ICONS.CHAT:
      return <ChatIcon className="folder-emoticon" />;
    case PREDEFINED_ICONS.PERSON:
      return <UserIcon className="folder-emoticon" />;
    case PREDEFINED_ICONS.GROUP:
      return <GroupIcon className="folder-emoticon" />;
    case PREDEFINED_ICONS.BOT:
      return <BotIcon className="folder-emoticon" />;
    case PREDEFINED_ICONS.STAR:
      return <StarIcon className="folder-emoticon" />;
    case PREDEFINED_ICONS.CHANNEL:
      return <ChannelIcon className="folder-emoticon" />;
    case PREDEFINED_ICONS.FOLDER:
      return <FolderIcon className="folder-emoticon" />;
    default:
      return <span className="emoji-emoticon">{renderText(emoticon, ['emoji'])[0]}</span>;
  }
};
const noop = () => {};
const ChatFolders: FC<OwnProps & StateProps> = ({
  foldersDispatch,
  onSettingsScreenSelect,
  onLeftColumnContentChange,
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  currentUserId,
  isForumPanelOpen,
  shouldSkipHistoryAnimations,
  maxFolders,
  maxChatLists,
  shouldHideFolderTabs,
  folderInvitesById,
  maxFolderInvites,
  hasArchivedChats,
  hasArchivedStories,
  archiveSettings,
  sessions,
  onSelectSettings,
  onSelectContacts,
  onSelectArchived,
  content,
  shouldHideSearch,
  onSelectMessages,
}) => {
  const {
    loadChatFolders,
    setActiveChatFolder,
    openChat,
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  const lang = useLang();

  useEffect(() => {
    loadChatFolders();
  }, []);

  const allChatsFolder: ApiChatFolder = useMemo(() => {
    return {
      id: ALL_FOLDER_ID,
      title: { text: lang('FilterAllChats') },
      includedChatIds: MEMO_EMPTY_ARRAY,
      excludedChatIds: MEMO_EMPTY_ARRAY,
    } satisfies ApiChatFolder;
  }, [lang]);

  const displayedFolders = useMemo(() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        if (id === ALL_FOLDER_ID) {
          return allChatsFolder;
        }

        return chatFoldersById[id] || {};
      }).filter(Boolean)
      : undefined;
  }, [chatFoldersById, allChatsFolder, orderedFolderIds]);

  const allChatsFolderIndex = displayedFolders?.findIndex((folder) => folder.id === ALL_FOLDER_ID);
  const isInAllChatsFolder = allChatsFolderIndex === activeChatFolder;
  const isInFirstFolder = FIRST_FOLDER_INDEX === activeChatFolder;

  const folderCountersById = useFolderManagerForUnreadCounters();
  const folderTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return displayedFolders.map((folder, i) => {
      const { id, title, emoticon } = folder;
      const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];

      if (canShareFolder) {
        contextActions.push({
          title: lang('FilterShare'),
          icon: 'link',
          handler: () => {
            const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
            if (chatListCount >= maxChatLists && !folder.isChatList) {
              openLimitReachedModal({
                limit: 'chatlistJoined',
              });
              return;
            }

            // Greater amount can be after premium downgrade
            if (folderInvitesById[id]?.length >= maxFolderInvites) {
              openLimitReachedModal({
                limit: 'chatlistInvites',
              });
              return;
            }

            openShareChatFolderModal({
              folderId: id,
            });
          },
        });
      }

      if (id !== ALL_FOLDER_ID) {
        contextActions.push({
          title: lang('FilterEdit'),
          icon: 'edit',
          handler: () => {
            openEditChatFolder({ folderId: id });
          },
        });

        contextActions.push({
          title: lang('FilterDelete'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            openDeleteChatFolderModal({ folderId: id });
          },
        });
      }

      return {
        id,
        title: renderTextWithEntities({
          text: title.text,
          // this is temporary code to avoid duplicating of custom emojis both as emoticon and in title
          entities: title.entities?.filter((ent) => ent.type !== ApiMessageEntityTypes.CustomEmoji),
          noCustomEmojiPlayback: folder.noTitleAnimations,
        }),
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        isBlocked,
        contextActions: contextActions?.length ? contextActions : undefined,
        emoticon: getEmoticon(id, emoticon, title.entities, title.text),
      } satisfies TabWithProperties;
    });
  }, [
    displayedFolders, maxFolders, folderCountersById, lang, chatFoldersById, maxChatLists, folderInvitesById,
    maxFolderInvites,
  ]);

  const handleSwitchTab = useLastCallback((index: number) => {
    onSelectMessages?.();
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
  });

  // Prevent `activeTab` pointing at non-existing folder after update
  useEffect(() => {
    if (!folderTabs?.length) {
      return;
    }

    if (activeChatFolder >= folderTabs.length) {
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX });
    }
  }, [activeChatFolder, folderTabs, setActiveChatFolder]);

  useEffect(() => {
    if (!IS_TOUCH_ENV || !folderTabs?.length || isForumPanelOpen || !transitionRef.current) {
      return undefined;
    }

    return captureEvents(transitionRef.current, {
      selectorToPreventScroll: '.chat-list',
      onSwipe: ((e, direction) => {
        if (direction === SwipeDirection.Left) {
          setActiveChatFolder(
            { activeChatFolder: Math.min(activeChatFolder + 1, folderTabs.length - 1) },
            { forceOnHeavyAnimation: true },
          );
          return true;
        } else if (direction === SwipeDirection.Right) {
          setActiveChatFolder({ activeChatFolder: Math.max(0, activeChatFolder - 1) }, { forceOnHeavyAnimation: true });
          return true;
        }

        return false;
      }),
    });
  }, [activeChatFolder, folderTabs, isForumPanelOpen, setActiveChatFolder]);

  const isNotInFirstFolderRef = useRef();
  isNotInFirstFolderRef.current = !isInFirstFolder;
  useEffect(() => (isNotInFirstFolderRef.current ? captureEscKeyListener(() => {
    if (isNotInFirstFolderRef.current) {
      setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX });
    }
  }) : undefined), [activeChatFolder, setActiveChatFolder]);

  useHistoryBack({
    isActive: !isInFirstFolder,
    onBack: () => setActiveChatFolder({ activeChatFolder: FIRST_FOLDER_INDEX }, { forceOnHeavyAnimation: true }),
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code.startsWith('Digit') && folderTabs) {
        const [, digit] = e.code.match(/Digit(\d)/) || [];
        if (!digit) return;

        if (digit === SAVED_MESSAGES_HOTKEY) {
          openChat({ id: currentUserId, shouldReplaceHistory: true });
          return;
        }

        const folder = Number(digit) - 1;
        if (folder > folderTabs.length - 1) return;

        setActiveChatFolder({ activeChatFolder: folder }, { forceOnHeavyAnimation: true });
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentUserId, folderTabs, openChat, setActiveChatFolder]);

  const {
    ref: placeholderRef,
    shouldRender: shouldRenderPlaceholder,
  } = useShowTransition({
    isOpen: !orderedFolderIds,
    noMountTransition: true,
    withShouldRender: true,
  });

  function renderCurrentTab(isActive: boolean) {
    const activeFolder = Object.values(chatFoldersById)
      .find(({ id }) => id === folderTabs![activeChatFolder].id);
    const isFolder = activeFolder && !isInAllChatsFolder;

    return (
      <ChatList
        folderType={isFolder ? 'folder' : 'all'}
        folderId={isFolder ? activeFolder.id : undefined}
        isActive={isActive}
        isForumPanelOpen={isForumPanelOpen}
        foldersDispatch={foldersDispatch}
        onSettingsScreenSelect={onSettingsScreenSelect}
        onLeftColumnContentChange={onLeftColumnContentChange}
        canDisplayArchive={(hasArchivedChats || hasArchivedStories) && !archiveSettings.isHidden}
        archiveSettings={archiveSettings}
        sessions={sessions}
      />
    );
  }

  const shouldRenderFolders = folderTabs && folderTabs.length > 1;
  const [isBotMenuOpen, markBotMenuOpen, unmarkBotMenuOpen] = useFlag();
  const { isMobile } = useAppLayout();
  const oldLang = useOldLang();

  const hasMenu = content === LeftColumnContent.ChatList;

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger }) => (
      <Button
        round
        ripple={hasMenu && !isMobile}
        size="smaller"
        color="translucent"
        onClick={onTrigger}
        ariaLabel={oldLang('AccDescrOpenMenu2')}
      >
        <div className={buildClassName(
          'animated-menu-icon',
        )}
        />
      </Button>
    );
  }, [hasMenu, isMobile, oldLang]);

  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);

  const isFullscreen = useFullscreenStatus();

  // Disable dropdown menu RTL animation for resize
  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  return (
    <div
      className={buildClassName(
        'ChatFolders',
        shouldRenderFolders && shouldHideFolderTabs && 'ChatFolders--tabs-hidden',
      )}
    >
      {shouldRenderFolders ? (
        <div>
          {!isMobile && (
            <DropdownMenu
              trigger={MainButton}
              footer={`${APP_NAME} ${versionString}`}
              className={buildClassName(
                'main-menu',
                'left-comumn-main-dropdown',
                oldLang.isRtl && 'rtl',
                shouldHideSearch && oldLang.isRtl && 'right-aligned',
                shouldDisableDropdownMenuTransitionRef.current && oldLang.isRtl && 'disable-transition',
              )}
              forceOpen={isBotMenuOpen}
              positionX={shouldHideSearch && oldLang.isRtl ? 'right' : 'left'}
              transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
              onTransitionEnd={oldLang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
            >
              <LeftSideMenuItems
                onSelectArchived={onSelectArchived || noop}
                onSelectContacts={onSelectContacts || noop}
                onSelectSettings={onSelectSettings || noop}
                onBotMenuOpened={markBotMenuOpen}
                onBotMenuClosed={unmarkBotMenuOpen}
              />
            </DropdownMenu>
          )}
          <TabList
            contextRootElementSelector="#LeftColumn"
            tabs={folderTabs}
            activeTab={activeChatFolder}
            onSwitchTab={handleSwitchTab}
          />
        </div>
      ) : shouldRenderPlaceholder ? (
        <div ref={placeholderRef} className="tabs-placeholder" />
      ) : undefined}
      {isMobile && (
        <Transition
          ref={transitionRef}
          name={shouldSkipHistoryAnimations ? 'none' : lang.isRtl ? 'slideOptimizedRtl' : 'slideOptimized'}
          activeKey={activeChatFolder}
          renderCount={shouldRenderFolders ? folderTabs.length : undefined}
        >
          {renderCurrentTab}
        </Transition>
      ) }
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
      chats: {
        listIds: {
          archived,
        },
      },
      stories: {
        orderedPeerIds: {
          archived: archivedStories,
        },
      },
      activeSessions: {
        byHash: sessions,
      },
      currentUserId,
      archiveSettings,
    } = global;

    const { shouldSkipHistoryAnimations, activeChatFolder } = selectTabState(global);
    const { storyViewer: { isRibbonShown: isStoryRibbonShown } } = selectTabState(global);

    return {
      chatFoldersById,
      folderInvitesById,
      orderedFolderIds,
      activeChatFolder,
      currentUserId,
      shouldSkipHistoryAnimations,
      hasArchivedChats: Boolean(archived?.length),
      hasArchivedStories: Boolean(archivedStories?.length),
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      archiveSettings,
      isStoryRibbonShown,
      sessions,
    };
  },
)(ChatFolders));
