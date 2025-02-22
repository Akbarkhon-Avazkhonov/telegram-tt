import React, { memo, useEffect, useState } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiInputMessageReplyInfo, ApiMessage } from '../../../api/types';
import type { ThemeKey, ThreadId } from '../../../types';

import { selectTheme } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { selectPartialText } from '../../../util/cursor-operations';

import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import Message from '../message/Message';

type StateProps = {
  theme:ThemeKey;
};
type OwnProps = {
  isOpen:boolean;
  onClose:()=>void;
  message:ApiMessage;
  threadId:ThreadId;
  handleEditQuoteSave:()=>void;
  replyInfo:ApiInputMessageReplyInfo;
};

const EditQuoteModal = ({
  handleEditQuoteSave, isOpen, message, onClose, threadId, replyInfo, theme,
}:OwnProps & StateProps) => {
  const lang = useLang();
  const oldLang = useOldLang();
  const [isSomeTextSelected, setIsSomeTextSelected] = useState(false);
  useEffect(() => {
    const container = document.querySelector('.edit-quote-modal')?.querySelector('.text-content');
    if (!container || !replyInfo?.quoteOffset || !replyInfo.quoteText?.text) {
      return () => {};
    }
    selectPartialText(container, replyInfo?.quoteOffset, replyInfo.quoteOffset + replyInfo.quoteText.text.length);
    const onSelectionChange = () => {
      setIsSomeTextSelected(Boolean(Number(window.getSelection()?.toString().length) > 0));
    };
    document.addEventListener('selectionchange', onSelectionChange);

    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [replyInfo]);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="edit-quote-modal"
    >
      <div className="modal-header" dir={lang.isRtl ? 'rtl' : undefined}>
        <Button
          round
          color="translucent"
          size="smaller"
          onClick={onClose}
          ariaLabel={lang('Close')}
        >
          <Icon name="close" />
        </Button>
      </div>
      {message && (
        <Message
          message={{ ...message, forwardInfo: undefined }}
          threadId={threadId}
          messageListType="thread"
          noComments
          noReplies
          appearanceOrder={0}
          isJustAdded={false}
          memoFirstUnreadIdRef={{
            current: undefined,
          }}
          getIsMessageListReady={undefined}
          isFirstInGroup={false}
          isLastInGroup={false}
          isFirstInDocumentGroup={false}
          isLastInDocumentGroup={false}
          isLastInList={false}
        />
      )}
      <div className={buildClassName('quote-hint', theme === 'light' && 'quote-hint--light')}>
        You can select a specific part to quoute
      </div>
      <div className="edit-quote-controls">
        <Button
          className="quote-control"
          size="tiny"
          onClick={onClose}
          color={theme === 'dark' ? undefined : 'translucent'}
        >{oldLang('lng_cancel')}
        </Button>
        <Button
          className="quote-control"
          size="tiny"
          color={theme === 'dark' ? undefined : 'adaptive'}
          onClick={handleEditQuoteSave}
        >{isSomeTextSelected ? oldLang('lng_reply_quote_selected') : oldLang('lng_context_reply_msg')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal((global):StateProps => {
  const theme = selectTheme(global);

  return {
    theme,
  };
})(EditQuoteModal));
