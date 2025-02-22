import React, {
  memo, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiChatFolder, ApiSession } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { LeftColumnContent } from '../../../types';

import { ALL_FOLDER_ID } from '../../../config';
import { selectTabState } from '../../../global/selectors';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';

import useLang from '../../../hooks/useLang';

import Transition from '../../ui/Transition';
import ChatList from './ChatList';

type OwnProps = {
  onLeftColumnContentChange:(content:LeftColumnContent)=> void;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  shouldSkipHistoryAnimations?: boolean;
  hasArchivedChats?: boolean;
  hasArchivedStories?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  sessions?: Record<string, ApiSession>;
};

const SelectedTabChatList = ({
  onLeftColumnContentChange,
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  shouldSkipHistoryAnimations,
  hasArchivedChats,
  hasArchivedStories,
  archiveSettings,
  sessions,
}:OwnProps & StateProps) => {
  const lang = useLang();
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

  const folderTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return displayedFolders.map((folder) => {
      const { id } = folder;

      return {
        id,
      };
    });
  }, [displayedFolders]);
  const allChatsFolderIndex = displayedFolders?.findIndex((folder) => folder.id === ALL_FOLDER_ID);

  const isInAllChatsFolder = allChatsFolderIndex === activeChatFolder;

  function renderCurrentTab(isActive: boolean) {
    const activeFolder = Object.values(chatFoldersById)
      .find(({ id }) => id === folderTabs![activeChatFolder].id);

    const isFolder = activeFolder && !isInAllChatsFolder;
    return (
      <ChatList
        folderType={isFolder ? 'folder' : 'all'}
        folderId={isFolder ? activeFolder.id : undefined}
        isActive={isActive}
        onLeftColumnContentChange={onLeftColumnContentChange}
        canDisplayArchive={(hasArchivedChats || hasArchivedStories) && !archiveSettings.isHidden}
        archiveSettings={archiveSettings}
        sessions={sessions}
      />
    );
  }
  return (
    <Transition
      activeKey={activeChatFolder}
      name={shouldSkipHistoryAnimations ? 'none' : lang.isRtl ? 'slideOptimizedRtl' : 'slideOptimized'}
    >
      {renderCurrentTab}
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
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
      archiveSettings,
    } = global;
    const { shouldSkipHistoryAnimations, activeChatFolder } = selectTabState(global);

    return {
      chatFoldersById,
      orderedFolderIds,
      activeChatFolder,
      shouldSkipHistoryAnimations,
      hasArchivedChats: Boolean(archived?.length),
      hasArchivedStories: Boolean(archivedStories?.length),
      archiveSettings,
      sessions,
    };
  },
)(SelectedTabChatList));
