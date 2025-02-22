import React, {
  memo,
  useCallback,
  useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../../../global';

import type { ApiSticker, ApiStickerSet } from '../../../../api/types';
import type { IAnchorPosition, StickerSetOrReactionsSetOrRecent } from '../../../../types';
import type { EmojiData, EmojiModule, EmojiRawData } from '../../../../util/emoji/emoji';
import type { EmojiCategoryData } from '../../../middle/composer/EmojiPicker';

import {
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER_HEADER, TOP_SYMBOL_SET_ID,
} from '../../../../config';
import {
  selectCanPlayAnimatedEmojis, selectChatFullInfo, selectIsAlwaysHighPriorityEmoji, selectIsCurrentUserPremium,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { uncompressEmoji } from '../../../../util/emoji/emoji';
import { pickTruthy, unique } from '../../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../../util/memo';
import { IS_TOUCH_ENV } from '../../../../util/windowEnvironment';
import {
  BotIcon, ChannelIcon, ChatIcon, ChatsIcon, FolderIcon, GroupIcon, StarIcon, UserIcon,
} from './icons/predifinedFolderIcons';

import useAppLayout from '../../../../hooks/useAppLayout';
import useHorizontalScroll from '../../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMouseInside from '../../../../hooks/useMouseInside';
import usePrevDuringAnimation from '../../../../hooks/usePrevDuringAnimation';
import useScrolledState from '../../../../hooks/useScrolledState';
import { useStickerPickerObservers } from '../../../common/hooks/useStickerPickerObservers';
import useAsyncRendering from '../../../right/hooks/useAsyncRendering';

import Icon from '../../../common/icons/Icon';
import StickerButton from '../../../common/StickerButton';
import StickerSet from '../../../common/StickerSet';
import EmojiCategory from '../../../middle/composer/EmojiCategory';
import StickerSetCover from '../../../middle/composer/StickerSetCover';
import Button from '../../../ui/Button';
import Loading from '../../../ui/Loading';
import Menu from '../../../ui/Menu';
import SearchInput from '../../../ui/SearchInput';

import styles from '../../../common/CustomEmojiPicker.module.scss';
import pickerStyles from '../../../middle/composer/StickerPicker.module.scss';

let emojiDataPromise: Promise<EmojiModule>;
let emojiRawData: EmojiRawData;
let emojiData: EmojiData;
const OPEN_ANIMATION_DELAY = 200;
const INTERSECTION_THROTTLE = 200;

const categoryIntersections: boolean[] = [];
function filterObjectBySearchValue(obj:Record<string, unknown>, searchValue:string) {
  const filtered:Record<string, unknown> = {};
  Object.keys(obj).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key.includes(searchValue)) {
        filtered[key] = obj[key];
      }
    }
  });
  return filtered;
}
export const PREDEFINED_ICONS = {
  CHATS: '💬',
  CHAT: '✅',
  PERSON: '👤',
  GROUP: '👥',
  STAR: '⭐',
  BOT: '🤖',
  CHANNEL: '📢',
  FOLDER: '📁',
} as const;
type OwnProps = {
  isOpen:boolean;
  onClose:NoneToVoidFunction;
  className:string;
  trigger:HTMLButtonElement | null;
  contextMenuAnchor?: IAnchorPosition;
  onEmojiSelect:(emoji:string, documentId?: string)=>void;
};

type StateProps = {
  addedCustomEmojiIds?:string[];
  chatEmojiSetId?:string;
  stickerSetsById: Record<string, ApiStickerSet>;
  customEmojiFeaturedIds?:string[];
  canAnimate: boolean;
  isCurrentUserPremium:boolean;
};

const FolderIconPicker = ({
  className,
  addedCustomEmojiIds,
  chatEmojiSetId,
  customEmojiFeaturedIds,
  stickerSetsById,
  canAnimate,
  isCurrentUserPremium,
  onEmojiSelect,
  onClose,
  isOpen,
  trigger,
  contextMenuAnchor,
}:OwnProps & StateProps) => {
  const containerClassName = buildClassName('EmojiPicker', className);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const { isMobile } = useAppLayout();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose, undefined, isMobile);

  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);
  const canLoadAndPlay = usePrevDuringAnimation(true, SLIDE_TRANSITION_DURATION);

  const allSets = useMemo(() => {
    const defaultSets: StickerSetOrReactionsSetOrRecent[] = [];
    const userSetIds = [...(addedCustomEmojiIds || [])];
    if (chatEmojiSetId) {
      userSetIds.unshift(chatEmojiSetId);
    }

    const setIdsToDisplay = unique(userSetIds.concat(customEmojiFeaturedIds || []));

    const setsToDisplay = Object.values(pickTruthy(stickerSetsById, setIdsToDisplay));

    return [
      ...defaultSets,
      ...setsToDisplay,
    ];
  }, [addedCustomEmojiIds, chatEmojiSetId, customEmojiFeaturedIds, stickerSetsById]);

  const prefix = 'custom-emoji-set-custom-emoji';
  const isHidden = false;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);
  const STICKER_SET_IDS_WITH_COVER = new Set([
    RECENT_SYMBOL_SET_ID,
    FAVORITE_SYMBOL_SET_ID,
    POPULAR_SYMBOL_SET_ID,
  ]);
  const FADED_BUTTON_SET_IDS = new Set([RECENT_SYMBOL_SET_ID, FAVORITE_SYMBOL_SET_ID, POPULAR_SYMBOL_SET_ID]);
  const handleCustomStickerGroupClick = useCallback((index: number) => {
    if (activeTab === 0) {
      setActiveTab(1);
    }
    setTimeout(() => {
      selectStickerSet(index, false, false, 120);
    }, 10);
  }, [activeTab, selectStickerSet]);
  function renderCover(stickerSet: StickerSetOrReactionsSetOrRecent, index: number) {
    const buttonClassName = buildClassName(
      pickerStyles.stickerCover,
      index === activeSetIndex && styles.activated,
    );
    const firstSticker = stickerSet.stickers?.[0];

    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;
    const isHq = selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet as ApiStickerSet);

    if (stickerSet.id === TOP_SYMBOL_SET_ID) {
      return undefined;
    }

    if (STICKER_SET_IDS_WITH_COVER.has(stickerSet.id) || stickerSet.hasThumbnail || !firstSticker) {
      const isFaded = FADED_BUTTON_SET_IDS.has(stickerSet.id);
      return (
        <Button
          key={stickerSet.id}
          className={buttonClassName}
          ariaLabel={stickerSet.title}
          round
          faded={isFaded}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => {
            if (activeTab === 0) {
              setActiveTab(1);
            }
            setTimeout(() => {
              selectStickerSet(index, false, false, 120);
            }, 10);
          }}
        >
          <StickerSetCover
            stickerSet={stickerSet as ApiStickerSet}
            noPlay={!canAnimate || !canLoadAndPlay}
            forcePlayback
            observeIntersection={observeIntersectionForCovers}
            sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
          />
        </Button>
      );
    }

    return (
      <StickerButton
        key={stickerSet.id}
        sticker={firstSticker}
        size={STICKER_SIZE_PICKER_HEADER}
        title={stickerSet.title}
        className={buttonClassName}
        noPlay={!canAnimate || !canLoadAndPlay}
        observeIntersection={observeIntersectionForCovers}
        noContextMenu
        isCurrentUserPremium
        sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
        withTranslucentThumb={false}
        onClick={handleCustomStickerGroupClick}
        clickArg={index}
        forcePlayback
      />
    );
  }

  const {
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();
  const areAddedLoaded = Boolean(addedCustomEmojiIds);
  const canRenderContent = useAsyncRendering([], SLIDE_TRANSITION_DURATION);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => set.stickers?.length).length === 0
  ), [allSets, areAddedLoaded]);

  const shouldRenderContent = areAddedLoaded && canRenderContent && !noPopulatedSets;

  useHorizontalScroll(headerRef, isMobile || !shouldRenderContent);

  const headerClassName = buildClassName(
    pickerStyles.header,
    'no-scrollbar',
    !shouldHideTopBorder && pickerStyles.headerWithBorder,
  );
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [categories, setCategories] = useState<EmojiCategoryData[]>();
  const [emojis, setEmojis] = useState<AllEmojis>({});
  const allCategories = useMemo(() => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }
    const themeCategories = [...categories];

    return themeCategories;
  }, [categories]);
  const { observe: observeIntersection } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  }, (entries) => {
    entries.forEach((entry) => {
      const { id } = entry.target as HTMLDivElement;
      if (!id || !id.startsWith('emoji-category-')) {
        return;
      }

      const index = Number(id.replace('emoji-category-', ''));
      categoryIntersections[index] = entry.isIntersecting;
    });

    const minIntersectingIndex = categoryIntersections.reduce((lowestIndex, isIntersecting, index) => {
      return isIntersecting && index < lowestIndex ? index : lowestIndex;
    }, Infinity);

    if (minIntersectingIndex === Infinity) {
      return;
    }

    setActiveCategoryIndex(minIntersectingIndex);
  });
  const setEmojiTab = useCallback(() => setActiveTab(0), []);
  const handlePredifinedChatsEmoji = useCallback(
    () => onEmojiSelect(PREDEFINED_ICONS.CHATS), [onEmojiSelect],
  );
  const handlePredifinedChatEmoji = useCallback(
    () => onEmojiSelect(PREDEFINED_ICONS.CHAT), [onEmojiSelect],
  );
  const handlePredifinedPersonEmoji = useCallback(
    () => onEmojiSelect(PREDEFINED_ICONS.PERSON), [onEmojiSelect],
  );
  const handlePredifinedGroupEmoji = useCallback(
    () => onEmojiSelect(PREDEFINED_ICONS.GROUP), [onEmojiSelect],
  );
  const handlePredifinedStarEmoji = useCallback(
    () => onEmojiSelect(PREDEFINED_ICONS.STAR), [onEmojiSelect],
  );
  const handlePredifinedBotEmoji = useCallback(
    () => onEmojiSelect(PREDEFINED_ICONS.BOT), [onEmojiSelect],
  );
  const handlePredifinedChannelEmoji = useCallback(
    () => onEmojiSelect(PREDEFINED_ICONS.CHANNEL), [onEmojiSelect],
  );
  const handlePredifinedFolderEmoji = useCallback(
    () => onEmojiSelect(PREDEFINED_ICONS.FOLDER), [onEmojiSelect],
  );
  useEffect(() => {
    setTimeout(() => {
      const exec = () => {
        setCategories(emojiData.categories);

        setEmojis(emojiData.emojis as AllEmojis);
      };

      if (emojiData) {
        exec();
      } else {
        ensureEmojiData()
          .then(exec);
      }
    }, OPEN_ANIMATION_DELAY);
  }, []);

  const getTriggerElement = useLastCallback(() => trigger);
  const getRootElement = useLastCallback(() => trigger?.closest('.custom-scroll, .no-scrollbar'));
  const getMenuElement = useLastCallback(() => document.querySelector('#portals .picker-tab .bubble'));
  const getLayout = useLastCallback(() => ({ withPortal: true }));
  const handleCustomEmojiSelect = useLastCallback((sticker:ApiSticker) => {
    onEmojiSelect(sticker.emoji!, sticker.id);
  });
  const handleEmojiSelect = useLastCallback((emoji:string) => {
    onEmojiSelect(emoji);
  });
  const [searchValue, setSearchValue] = useState('');
  if (!shouldRenderContent) {
    return (
      <div className={containerClassName}>
        <Loading />
      </div>
    );
  }

  return (
    <Menu
      isOpen={isOpen}
      withPortal
      onClose={onClose}
      className={containerClassName}
      onCloseAnimationEnd={onClose}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      getTriggerElement={getTriggerElement}
      getRootElement={getRootElement}
      getMenuElement={getMenuElement}
      getLayout={getLayout}
      anchor={contextMenuAnchor}
    >
      <div
        ref={headerRef}
        className={headerClassName}
      >
        <div className="shared-canvas-container">
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          <Button
            key="regular-smiles"
            className={pickerStyles.stickerCover}
            ariaLabel="default emojis"
            round
            onClick={setEmojiTab}
            color="translucent"
          >
            <Icon name="smile" />
          </Button>
          {allSets.map(renderCover)}
        </div>
      </div>

      <SearchInput className="folder-emoticon-search" placeholder="Search Emoji" onChange={setSearchValue} />
      <div className="predifined-folder-icons-list">
        <Button
          color="translucent"
          onClick={handlePredifinedChatsEmoji}
          className="predefined-icon"
          size="tiny"
        >
          <ChatsIcon />
        </Button>
        <Button
          color="translucent"
          onClick={handlePredifinedChatEmoji}
          className="predefined-icon"
          size="tiny"
        >
          <ChatIcon className="predefined-icon" />
        </Button>
        <Button
          color="translucent"
          onClick={handlePredifinedPersonEmoji}
          className="predefined-icon"
          size="tiny"
        ><UserIcon />
        </Button>
        <Button
          color="translucent"
          onClick={handlePredifinedGroupEmoji}
          className="predefined-icon"
          size="tiny"
        ><GroupIcon />
        </Button>
        <Button
          color="translucent"
          onClick={handlePredifinedStarEmoji}
          className="predefined-icon"
          size="tiny"
        ><StarIcon />
        </Button>
        <Button
          color="translucent"
          onClick={handlePredifinedChannelEmoji}
          className="predefined-icon"
          size="tiny"
        ><ChannelIcon />
        </Button>
        <Button
          color="translucent"
          onClick={handlePredifinedBotEmoji}
          className="predefined-icon"
          size="tiny"
        ><BotIcon />
        </Button>
        <Button
          color="translucent"
          onClick={handlePredifinedFolderEmoji}
          className="predefined-icon"
          size="tiny"
        ><FolderIcon />
        </Button>
      </div>
      <div
        ref={containerRef}
        className={buildClassName('EmojiPicker-main', IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
      >
        {activeTab === 0 && allCategories.map((category, i) => (
          <EmojiCategory
            category={category}
            index={i + 1}
            allEmojis={filterObjectBySearchValue(emojis, searchValue) as AllEmojis}
            observeIntersection={observeIntersection}
            shouldRender={activeCategoryIndex >= i - 1 && activeCategoryIndex <= i + 1}
            onEmojiSelect={handleEmojiSelect}
          />
        ))}
        {activeTab === 1 && allSets.map((stickerSet, i) => {
          const isChatEmojiSet = stickerSet.id === chatEmojiSetId;

          return (
            <StickerSet
              key={stickerSet.id}
              stickerSet={stickerSet}
              loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
              index={i}
              idPrefix={prefix}
              observeIntersection={observeIntersectionForSet}
              observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
              observeIntersectionForShowingItems={observeIntersectionForShowingItems}
              isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
              isSavedMessages={false}
              isStatusPicker={false}
              isReactionPicker={false}
              isChatEmojiSet={isChatEmojiSet}
              isCurrentUserPremium={isCurrentUserPremium}
              onStickerSelect={handleCustomEmojiSelect}
              forcePlayback
            />
          );
        })}
      </div>
    </Menu>
  );
};

async function ensureEmojiData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('emoji-data-ios/emoji-data.json');
    emojiRawData = (await emojiDataPromise).default;

    emojiData = uncompressEmoji(emojiRawData);
  }

  return emojiDataPromise;
}

export default memo(withGlobal((global, { chatId, isStatusPicker }) => {
  const {
    stickers: {
      setsById: stickerSetsById,
    },
    customEmojis: {
      featuredIds: customEmojiFeaturedIds,

    },
    recentCustomEmojis: recentCustomEmojiIds,
  } = global;
  const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;

  return {
    recentCustomEmojiIds: !isStatusPicker ? recentCustomEmojiIds : undefined,
    stickerSetsById,
    addedCustomEmojiIds: global.customEmojis.added.setIds,
    canAnimate: selectCanPlayAnimatedEmojis(global),
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    customEmojiFeaturedIds,
    chatEmojiSetId: chatFullInfo?.emojiSet?.id,
  };
})(FolderIconPicker));
